// operators/assistant.js
import { OpenAI } from "openai";
import readline from "readline";
import { AgenticChain } from "./AgenticChain.js";
import { toolsJson } from "./inline-tools.js";

/** @typedef {(...args: any[]) => any} Fn */

const DEFAULT_TOOLSETS = {
  yesno: [
    {
      name: "Yes or No",
      type: "function",
      description: "Provide a boolean choice",
      inputSchema: {
        type: "object",
        properties: { choice: { type: "boolean" } },
        required: ["choice"],
      },
      fn: async (a) => a,
    },
  ],
  choice: [
    {
      name: "Make a Choice",
      type: "function",
      description: "Provide a choice as a callback",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      fn: async (a) => a,
    },
  ],
  text: [
    {
      name: "Make a Text Output",
      type: "function",
      description: "Provide a text output",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      fn: async (a) => a,
    },
  ],
};

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");

const toSchema = (specs) =>
  specs.map((t) =>
    t.name && t.inputSchema
      ? {
          type: "function",
          name: t.name,
          description: t.description || "",
          parameters: {
            ...t.inputSchema,
            required: t.inputSchema.required || [],
          },
        }
      : { ...t }
  );

const defaultInstruction = (k) =>
  k === "yesno"
    ? "Answer strictly by calling the yes/no tool with { choice: true | false } based on factual truth."
    : k === "choice"
    ? "Respond strictly by calling the choice tool with { text: <your choice> }."
    : "Respond strictly by calling the text tool with { text: <your text> }.";

/**
 * @template TTool extends Fn
 */
export class ChatAssistant {
  /**
   * @param {{ model?: string; instructions?: string; tools?: TTool[] }} [opts]
   */
  constructor({ model = "gpt-5-mini", instructions = "", tools } = {}) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = String(model).trim();
    this.inst = instructions;
    const parsed = tools === undefined ? [] : toolsJson(tools);
    this.tools = parsed
      ? parsed.map(({ fn, ...rest }) => {
          if (!rest.name || !rest.type) throw Error("tool");
          return { ...rest, fn };
        })
      : [];
    this.prev = null;
  }

  /*
  fork() {
    const a = new ChatAssistant({
      model: this.model,
      instructions: this.inst,
      tools: this.tools,
    });
    a.client = this.client;
    return a;
  }*/

  clear() {
    this.prev = null;
  }

  async #call(payload, store = true) {
    if (store) {
      payload.store = true;
      payload.previous_response_id = this.prev || undefined;
    }
    const r = await this.client.responses.create(payload);
    if (store) this.prev = r.id;
    return r;
  }

  async #handle(resp, specs, instructions, store = true) {
    const fc = (resp.output || []).find((i) => i.type === "function_call");
    if (!fc) return { type: "text", text: resp.output_text, error: null };

    let result, error, args;
    try {
      args = fc.arguments ? JSON.parse(fc.arguments) : {};
      const t = specs.find(
        (x) =>
          ((x.function && x.function.name === fc.name) || x.name === fc.name) &&
          typeof x.fn === "function"
      );
      if (!t) throw Error("Tool not found");
      result = await t.fn(args);
    } catch (e) {
      error = { tool: fc?.name, message: e?.message || String(e) };
    }
    if (!error && result === undefined)
      error = { tool: fc?.name, message: "Tool returned undefined" };

    const follow = await this.#call(
      {
        model: this.model,
        input: [
          {
            type: "function_call_output",
            call_id: fc.call_id,
            output: JSON.stringify(result ?? ""),
          },
        ],
        tools: toSchema(specs),
        instructions,
        tool_choice: "auto",
      },
      store
    );

    return {
      type: "tool",
      name: fc.name,
      args: args || {},
      result,
      text: follow.output_text,
      error,
    };
  }

  #prepareTools(tools) {
    const raw = tools !== undefined ? tools : this.tools;
    const nameMap = new Map();
    const withSlugs = raw.map((t) => {
      const orig = t.name || (t.function && t.function.name) || "tool";
      const s = slug(orig);
      nameMap.set(s, orig);
      return {
        ...t,
        name: s,
        function: t.function ? { ...t.function, name: s } : undefined,
      };
    });
    return { list: withSlugs, nameMap };
  }

  async #invoke(prompt, { tools, instructions, toolChoice, oneOff }) {
    const { list, nameMap } = this.#prepareTools(tools);
    const schema = toSchema(list);
    const r = await this.#call(
      {
        model: this.model,
        input: [{ role: "user", content: prompt }],
        tools: schema,
        instructions,
        tool_choice: toolChoice,
      },
      !oneOff
    );
    const out = await this.#handle(r, list, instructions, !oneOff);
    if (out.name) out.name = nameMap.get(out.name) || out.name;
    return out;
  }

  async choice(prompt, { kind = "yesno", tools, instructions, oneOff } = {}) {
    const base =
      tools && tools.length
        ? toolsJson(tools)
        : DEFAULT_TOOLSETS[kind] || DEFAULT_TOOLSETS.text;
    return this.#invoke(prompt, {
      tools: base,
      instructions: instructions ?? defaultInstruction(kind),
      toolChoice: "required",
      oneOff,
    });
  }

  async chat(prompt, { tools, force, instructions, oneOff } = {}) {
    const selected = tools === undefined ? undefined : toolsJson(tools);
    const toolChoice =
      force === true ? "required" : force === false ? "none" : "auto";
    return this.#invoke(prompt, {
      tools: selected,
      instructions: instructions ?? this.inst,
      toolChoice,
      oneOff,
    });
  }

  prompt(message = null, options = {}) {
    return new Promise((res) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(message ?? "> ", async (i) => {
        rl.close();
        try {
          res(
            i.toLowerCase() === "exit"
              ? { type: "exit" }
              : await this.chat(i, options)
          );
        } catch (e) {
          res({ error: e.message || e });
        }
      });
    });
  }

  //Decide is just a wrapper for chat with a forced tool call.
  async decide(prompt, options = {}) {
    return this.chat(prompt, {
      ...options,
      force: true,
    });
  }

  //Discuss is just a wrapper for chat, without any tool calls.
  async discuss(prompt, options = {}) {
    return this.chat(prompt, {
      ...options,
      force: false,
    });
  }

  async solo(prompt, options = {}) {
    const { tools: _ignored, ...rest } = options;
    return this.chat(prompt, {
      ...rest,
      tools: [],
      force: false,
      oneOff: true,
    });
  }

  fork(overrides = {}) {
    const a = new ChatAssistant({
      model: overrides.model ?? this.model,
      instructions: overrides.instructions ?? this.inst,
      tools: overrides.tools
        ? toolsJson(overrides.tools)
        : this.tools.map((t) => ({ ...t })),
    });
    a.client = this.client;
    return a;
  }

  chain(opts = {}) {
    const { fork = true, ...overrides } = opts;
    const base = fork ? this.fork(overrides) : this;
    if (!fork && Object.keys(overrides).length) {
      if (overrides.model) base.model = overrides.model;
      if (overrides.instructions) base.inst = overrides.instructions;
      if (overrides.tools) base.tools = toolsJson(overrides.tools);
    }
    return new AgenticChain(base);
  }

  addTools(fns = []) {
    if (!Array.isArray(fns) || !fns.length) return this;
    const added = toolsJson(fns);
    if (!added.length) return this;
    const byName = new Map(this.tools.map((t) => [t.name, t]));
    for (const t of added) byName.set(t.name, t);
    this.tools = Array.from(byName.values());
    return this;
  }

  removeTools(fns = []) {
    if (!Array.isArray(fns) || !fns.length) return this;
    const fnSet = new Set(fns.filter((x) => typeof x === "function"));
    const nameSet = new Set([...fnSet].map((fn) => fn.name).filter(Boolean));
    const slugNameSet = new Set([...nameSet].map((n) => slug(n)));
    this.tools = this.tools.filter(
      (t) =>
        !fnSet.has(t.fn) &&
        !nameSet.has(t.name) &&
        !slugNameSet.has(slug(t.name))
    );
    return this;
  }

  clearTools() {
    this.tools = [];
    return this;
  }
}
