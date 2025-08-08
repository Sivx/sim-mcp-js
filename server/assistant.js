import { OpenAI } from "openai";
import readline from "readline";
import { AgenticChain } from "./AgenticChain.js";
import { toolsJson } from "./inline-tools";
import { extractToolsJson } from "./extractToolsJson";
import { tool } from "@openai/agents";

function getTools(tools) {
  if (Array.isArray(tools)) {
    if (tools.length === 0) return [];
    return toolsJson(tools);
  } else if (typeof tools === "string") {
    try {
      tools = JSON.parse(tools);
    } catch (e) {
      //this is the filename scenario
      tools = extractToolsJson(tools);
    }
  }
  return tools;
}
export class ChatAssistant {
  /**
   * @param {Object} [options]
   * @param {string} [options.model]
   * @param {string} [options.instructions]
   * @param {any[]} [options.tools]
   */
  constructor({ model = "gpt-4.1-mini", instructions = "", tools = [] } = {}) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = model.trim();
    this.inst = instructions;
    if (tools) {
      tools = getTools(tools);
      //tools = toolsJson(tools);
      this.tools = tools.map(({ fn, ...r }) => {
        if (!r.name || !r.type) throw Error("tool");
        return { ...r, fn };
      });
    }

    this.prev = null;
  }
  clear() {
    this.prev = null;
  }
  normalizeToolName(n) {
    return String(n)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
  }

  async choice(prompt, options = {}) {
    let { kind = "yesno", tools, instructions, oneOff } = options;

    let toolsJsonStr =
      kind === "yesno"
        ? getYesNoTool()
        : kind === "choice"
        ? getChoiceTool()
        : getTextTool();

    // Build tools with echo fn
    let rawTools = tools
      ? getTools(tools)
      : JSON.parse(toolsJsonStr).map((t) => ({
          ...t,
          fn: async (args) => args,
        }));

    // Remember original names to match calls
    const nameMap = new Map();
    rawTools = rawTools.map((t) => {
      const original = t.name || (t.function && t.function.name) || "tool";
      const normalized = this.normalizeToolName(original);
      nameMap.set(normalized, original);
      // ensure top-level name exists/updated
      return {
        ...t,
        name: normalized,
        function: t.function ? { ...t.function, name: normalized } : undefined,
      };
    });

    // Convert to API schema
    const t = rawTools.map((tool) => {
      if (tool.name && tool.inputSchema) {
        return {
          type: "function",
          name: tool.name, // already normalized
          description: tool.description || "",
          parameters: {
            ...tool.inputSchema,
            required: tool.inputSchema.required || [],
          },
        };
      }
      return { ...tool };
    });

    const params = {
      model: this.model,
      input: [{ role: "user", content: prompt }],
      tools: t,
      instructions:
        instructions ??
        (kind === "yesno"
          ? "Answer strictly by calling the yes/no tool with { choice: true | false } based on factual truth."
          : kind === "choice"
          ? "Respond strictly by calling the choice tool with { text: <your choice> }."
          : "Respond strictly by calling the text tool with { text: <your text> }."),
      tool_choice: "required",
    };

    if (!oneOff) {
      params.store = true;
      params.previous_response_id = this.prev || undefined;
    }

    const r1 = await this.client.responses.create(params);
    if (!oneOff) this.prev = r1.id;

    const fc = (r1.output || []).find((i) => i.type === "function_call");
    if (!fc) return { type: "text", text: r1.output_text, error: null };

    let res, err, args;
    try {
      args = fc.arguments ? JSON.parse(fc.arguments) : {};
      const tool = rawTools.find(
        (x) =>
          (x.function &&
            x.function.name === fc.name &&
            typeof x.fn === "function") ||
          (x.name === fc.name && typeof x.fn === "function")
      );
      if (!tool) throw new Error("Tool not found");
      res = await tool.fn(args);
    } catch (e) {
      err = { tool: fc.name, message: e.message };
    }
    if (!err && res === undefined)
      err = { tool: fc.name, message: "Tool returned undefined" };

    const params2 = {
      model: this.model,
      input: [
        {
          type: "function_call_output",
          call_id: fc.call_id,
          output: JSON.stringify(res ?? ""),
        },
      ],
      tools: t,
      instructions: params.instructions,
      tool_choice: "auto",
    };
    if (!oneOff) {
      params2.store = true;
      params2.previous_response_id = r1.id;
    }

    const r2 = await this.client.responses.create(params2);
    if (!oneOff) this.prev = r2.id;

    // expose both normalized and original name if needed
    return {
      type: "tool",
      name: nameMap.get(fc.name) || fc.name,
      args: args || {},
      result: res,
      text: r2.output_text,
      error: err,
    };
  }
  async chat(prompt, options = {}) {
    let { tools, force, instructions, oneOff } = options;
    tools = getTools(tools);
    const t = (tools && tools.length ? tools : this.tools).map((tool) => {
      if (tool.name && tool.inputSchema) {
        //tool.inputSchema.parameters.additionalProperties = false; // Ensure no additional properties
        // Old schema to new
        let tmp = {
          type: "function",
          name: tool.name,
          description: tool.description || "",
          parameters: {
            ...tool.inputSchema,
            required: tool.inputSchema.required || [],
            //additionalProperties: false,
          },
        };
        return tmp;
      }
      return { ...tool };
    });

    //const t = tools && tools.length ? tools : this.tools;

    const tf = tools && tools.length ? tools : this.tools;
    const tc = force === true ? "required" : force === false ? "none" : "auto";
    const params = {
      model: this.model,
      input: [
        {
          role: "user",
          content: prompt,
        },
      ],
      tools: t,
      instructions: instructions ?? this.inst,
      tool_choice: tc,
    };
    if (!oneOff) {
      params.store = true;
      params.previous_response_id = this.prev || undefined;
    }
    const r1 = await this.client.responses.create(params);
    if (!oneOff) this.prev = r1.id;
    const fc = (r1.output || []).find((i) => i.type === "function_call");
    if (!fc) return { type: "text", text: r1.output_text, error: null };
    let res, err, args;
    try {
      args = fc.arguments ? JSON.parse(fc.arguments) : {};
      // Find tool by function.name (new schema)
      const tool = tf.find(
        (x) =>
          (x.function &&
            x.function.name === fc.name &&
            typeof x.fn === "function") ||
          (x.name === fc.name && typeof x.fn === "function")
      );
      if (!tool) throw new Error("Tool not found");
      res = await tool.fn(args);
    } catch (e) {
      err = { tool: fc.name, message: e.message };
    }
    if (!err && res === undefined)
      err = { tool: fc.name, message: "Tool returned undefined" };
    const params2 = {
      model: this.model,
      input: [
        {
          type: "function_call_output",
          call_id: fc.call_id,
          output: JSON.stringify(res ?? ""),
        },
      ],
      tools: t,
      instructions: instructions ?? this.inst,
      tool_choice: "auto",
    };
    if (!oneOff) {
      params2.store = true;
      params2.previous_response_id = r1.id;
    }
    const r2 = await this.client.responses.create(params2);
    if (!oneOff) this.prev = r2.id;
    return {
      type: "tool",
      name: fc.name,
      args: args || {},
      result: res,
      text: r2.output_text,
      error: err,
    };
  }

  prompt(message = null, options = {}) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(message !== null ? message : "> ", async (input) => {
        rl.close();
        try {
          if (input.toLowerCase() === "exit") {
            resolve({ type: "exit" });
          } else resolve(await this.chat(input, options));
        } catch (e) {
          resolve({ error: e.message || e });
        }
      });
    });
  }
  async decide(prompt, options = {}) {
    if (options.tools && options.tools.length) {
      options.tools = getTools(options.tools);
    }
    const tools =
      options.tools && options.tools.length ? options.tools : this.tools;
    if (!tools || !tools.length) throw Error("decide: no tools available");
    return this.chat(prompt, { ...options, force: true, tools });
  }
  async discuss(prompt, options = {}) {
    if (options.tools && options.tools.length) {
      options.tools = getTools(options.tools);
    }
    return this.chat(prompt, { ...options, force: undefined });
  }
  async solo(prompt, options = {}) {
    if (options.tools && options.tools.length) {
      options.tools = getTools(options.tools);
    }
    return this.chat(prompt, {
      ...options,
      tools: [],
      force: false,
      oneOff: true,
    });
  }
  chain() {
    return new AgenticChain(this);
  }
}

function getTextTool() {
  return JSON.stringify([
    {
      name: "Make a Text Output",
      type: "function",
      description: "Provide a text output",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
          },
        },
        required: ["text"],
      },
    },
  ]);
}

function getChoiceTool() {
  return JSON.stringify([
    {
      name: "Make a Choice",
      type: "function",
      description: "Provide a choice as a callback",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
          },
        },
        required: ["text"],
      },
    },
  ]);
}

function getYesNoTool() {
  return JSON.stringify([
    {
      name: "Yes or No",
      type: "function",
      description: "Provide a boolean choice",
      inputSchema: {
        type: "object",
        properties: {
          choice: {
            type: "boolean",
          },
        },
        required: ["choice"],
      },
    },
  ]);
}
