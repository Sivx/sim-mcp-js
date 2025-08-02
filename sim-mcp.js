import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs";
import { z } from "zod";
import { parseParams } from "./server/parseParams.js";
import { run } from "./client/run.js";
import content from "./server/content.js";
import { prompt, mcpToolsJson } from "./server/utils.js";
import { httpFlow } from "./server/flow.js";
import { stdioFlow } from "./server/stdioFlow.js";
import { registerTools } from "./server/toolRegister.js";
import crypto from "crypto";
import { invokeTool } from "./client/raw.js";

const envPort = process.env.MCP_PORT;

let memory = {};

function createHookedObject(obj, updateFn) {
  return new Proxy(obj, {
    set(target, prop, value) {
      target[prop] = value;
      updateFn(prop, value);
      return true;
    },
  });
}

export default {
  ...content,
  tool(fn, arr) {
    fn._toolParams = parseParams(arr);
    return fn;
  },
  prompt,
  async start(def, tools) {
    if (process.send) {
      process.on("message", (msg) => {
        for (const [key, value] of Object.entries(msg)) {
          memory[key] = value;
        }
      });
    }
    let [n, v = "0.0.1"] = def.split("@"),
      file = process.argv[1];
    if (file && fs.existsSync(file)) {
      let code = fs.readFileSync(file, "utf8"),
        markerRegex = /\/\/mcp-marker:[a-f0-9]{40}/g;

      let codeNoMarker = code.replace(markerRegex, "");
      const fileBodyHash = crypto
        .createHash("sha1")
        .update(codeNoMarker)
        .digest("hex");
      const marker = `//mcp-marker:${fileBodyHash}`;

      if (!code.includes(marker)) {
        let mcpRegex = /\/\*\s*mcp[\s\S]*?\*\//gi,
          simRegex = /\/\*\s*sim-mcp[\s\S]*?\*\//gi;
        let body = code
          .replace(mcpRegex, "")
          .replace(simRegex, "")
          .replace(markerRegex, "")
          .trim();

        let simBlock = `/* sim-mcp\n${prompt(tools)}\n*/`,
          pd = JSON.stringify(mcpToolsJson(tools), null, 2),
          mcpBlock = `/* mcp v2 json\n${pd}\n*/`;

        let newCode =
          simBlock + "\n" + body + "\n" + mcpBlock + "\n" + marker + "\n";
        fs.writeFileSync(file, newCode);
      }
    }

    if (process.argv.some((a) => a === "--prompt" || a === "--docs")) {
      let pd = JSON.stringify(mcpToolsJson(tools), null, 2);
      console.log(pd);
      process.exit(0);
    }
    let s = new McpServer({ name: n, version: v });
    let hooked_memory = createHookedObject(memory, (key, value) => {
      if (process.send) {
        process.send({ [key]: value });
      }
      memory[key] = value;
    });
    registerTools(s, tools, hooked_memory);
    if (envPort && !process.env.SIM_MCP_RUN) {
      //console.log("Starting MCP server on port", envPort);
      await httpFlow(s);
    } else {
      //console.log("Starting MCP server in stdio mode");
      await stdioFlow(s);
      //console.log("MCP server ended in stdio mode");
    }
  },
  test(tool, params) {
    const sc = z.object(tool._toolParams || {});
    const p = sc.safeParse(params);
    if (!p.success) return { error: p.error };
    return tool(params);
  },
  run: run,
  invokeTool: invokeTool,
  /*
  setMemory: (update) => {
    for (const [key, value] of Object.entries(update || {})) {
      memory[key] = value;
    }
    if (process.send) {
      process.send(update);
    }
  },*/
};

export { parseParams };
