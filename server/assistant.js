import { OpenAI } from "openai";
import readline from "readline";
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
    this.tools = tools.map(({ fn, ...r }) => {
      if (!r.name || !r.type) throw Error("tool");
      return { ...r, fn };
    });
    this.prev = null;
  }
  clear() {
    this.prev = null;
  }
  async chat(prompt, options = {}) {
    const { tools, force, instructions, oneOff } = options;
    const t = (tools && tools.length ? tools : this.tools).map(
      ({ fn, ...r }) => r
    );
    const tf = tools && tools.length ? tools : this.tools;
    const tc = force === true ? "required" : force === false ? "none" : "auto";
    const params = {
      model: this.model,
      input: prompt,
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
      const tool = tf.find(
        (x) => x.name === fc.name && typeof x.fn === "function"
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
    const tools =
      options.tools && options.tools.length ? options.tools : this.tools;
    if (!tools || !tools.length) throw Error("decide: no tools available");
    return this.chat(prompt, { ...options, force: true, tools });
  }
  async discuss(prompt, options = {}) {
    return this.chat(prompt, { ...options, force: undefined });
  }
  async solo(prompt, options = {}) {
    return this.chat(prompt, {
      ...options,
      tools: [],
      force: false,
      oneOff: true,
    });
  }
}
