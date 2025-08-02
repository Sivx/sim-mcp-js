import { parseKey } from "./utils.js";

export function registerTools(server, tools, _memory = {}) {
  for (const [tk, tf] of Object.entries(tools)) {
    const { name: tn, description: d } = parseKey(tk);
    const paramSchema = tf._toolParams ?? {};
    const h = async (params) => {
      const r = await tf({ memory: _memory, ...params, _memory: _memory });
      if (typeof r === "string") return { type: "text", text: r };
      if (typeof r === "object") {
        if (r.type && r[r.type]) return r;
        return { type: "json", json: r };
      }
      return { type: "text", text: String(r) };
    };
    server.tool(tn, paramSchema, h, { description: d });
  }
}
