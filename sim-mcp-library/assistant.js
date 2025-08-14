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
  async #handle(
    resp,
    specs,
    instructions,
    store = true,
    parallelToolCalls = true
  ) {
    let finalText = resp.output_text;
    const calls = [];
    while (true) {
      const fcs = (resp.output || []).filter((i) => i.type === "function_call");
      if (!fcs.length) break;
      const run = async (fc) => {
        let result, error, args;
        try {
          args = fc.arguments ? JSON.parse(fc.arguments) : {};
          const t = specs.find((x) => x.name === fc.name);
          if (!t || typeof t.fn !== "function") throw Error("Tool not found");
          if (t.positional) {
            const arr = Array.isArray(args)
              ? args
              : args && typeof args === "object"
              ? t.paramOrder
                ? t.paramOrder.map((k) => args[k])
                : Object.values(args)
              : [];
            result = await t.fn(...arr);
          } else result = await t.fn(args);
          if (typeof result === "undefined")
            throw Error("Tool returned undefined");
        } catch (e) {
          error = { tool: fc?.name, message: e?.message || String(e) };
        }
        calls.push({ name: fc.name, args: args || {}, result, error });
        return {
          type: "function_call_output",
          call_id: fc.call_id,
          output: JSON.stringify(result ?? ""),
        };
      };
      const outputs = parallelToolCalls
        ? await Promise.all(fcs.map(run))
        : await (async () => {
            const out = [];
            for (const fc of fcs) out.push(await run(fc));
            return out;
          })();
      resp = await this.#call(
        {
          model: this.model,
          input: outputs,
          tools: toSchema(specs),
          instructions,
          tool_choice: "auto",
          parallel_tool_calls: !!parallelToolCalls,
        },
        store
      );
      finalText = resp.output_text ?? finalText;
    }
    if (!calls.length) return { type: "text", text: finalText, error: null };
    return { type: "tools", calls, text: finalText, error: null };
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
  async #invoke(
    prompt,
    { tools, instructions, toolChoice, oneOff, parallelToolCalls }
  ) {
    const { list, nameMap } = this.#prepareTools(tools);
    const schema = toSchema(list);
    const r = await this.#call(
      {
        model: this.model,
        input: [{ role: "user", content: prompt }],
        tools: schema,
        instructions,
        tool_choice: toolChoice,
        parallel_tool_calls: parallelToolCalls !== false,
      },
      !oneOff
    );
    const out = await this.#handle(
      r,
      list,
      instructions,
      !oneOff,
      parallelToolCalls !== false
    );
    if (out.calls && out.calls.length) {
      out.calls = out.calls.map((c) => ({
        ...c,
        name: nameMap.get(c.name) || c.name,
      }));
    }
    return out;
  }
  async choice(
    prompt,
    { kind = "yesno", tools, instructions, oneOff, parallelToolCalls } = {}
  ) {
    const base =
      tools && tools.length
        ? toolsJson(tools)
        : DEFAULT_TOOLSETS[kind] || DEFAULT_TOOLSETS.text;
    return this.#invoke(prompt, {
      tools: base,
      instructions: instructions ?? defaultInstruction(kind),
      toolChoice: "required",
      oneOff,
      parallelToolCalls,
    });
  }
  async chat(
    prompt,
    { tools, force, instructions, oneOff, parallelToolCalls } = {}
  ) {
    const selected = tools === undefined ? undefined : toolsJson(tools);
    const toolChoice =
      force === true ? "required" : force === false ? "none" : "auto";
    return this.#invoke(prompt, {
      tools: selected,
      instructions: instructions ?? this.inst,
      toolChoice,
      oneOff,
      parallelToolCalls,
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
