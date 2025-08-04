// stdio.ts
import fs from "fs";
import readline from "readline";
import { extractToolsJson } from "./extractToolsJson"; // path as needed

const scriptFile = process.argv[1];
const source = fs.readFileSync(scriptFile, "utf8");
const toolsArr = extractToolsJson(source, { flattenSingleObjectParam: true });
const toolsMap = Object.fromEntries(toolsArr.map((t) => [t.name, t]));

console.error("[MCP] Agent started");

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  (async () => {
    // Dynamically import self for function references
    const mod = await import(
      scriptFile.startsWith("file://") ? scriptFile : `file://${scriptFile}`
    );
    const r = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    for await (const line of r) {
      console.error("[MCP] RECV", line.trim());
      try {
        const req = JSON.parse(line);
        const { id, method, params } = req;
        if (method === "initialize") {
          process.stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                protocolVersion: params.protocolVersion,
                serverInfo: { name: "auto-mcp", version: "1.0.0" },
                capabilities: { tools: { listChanged: false } },
              },
            }) + "\n"
          );
          console.error("[MCP] initialize → ok");
        } else if (method === "tools/list") {
          process.stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: { tools: toolsArr },
            }) + "\n"
          );
          console.error("[MCP] sent tools/list");
        } else if (method === "tools/call") {
          const t = params.tool ?? params.name;
          const fn = mod[t];
          if (!fn) {
            process.stdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                error: { code: -32601, message: "Tool not found" },
              }) + "\n"
            );
            continue;
          }
          // Use Inspector's preferred object input
          const inputArg = params.input ?? params.arguments;
          let res;
          try {
            // If tool expects multiple params (by schema), spread the args; otherwise, pass as object
            if (Array.isArray(inputArg)) res = await fn(...inputArg);
            else res = await fn(inputArg);
          } catch (e: any) {
            process.stdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                result: { content: e.message, isError: true },
              }) + "\n"
            );
            continue;
          }
          process.stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                content: typeof res === "string" ? res : JSON.stringify(res),
                structuredContent: res,
                isError: false,
              },
            }) + "\n"
          );
          console.error("[MCP] tool", t, "returned");
        } else {
          process.stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: `Unknown method "${method}"` },
            }) + "\n"
          );
          console.error("[MCP] Unknown method", method);
        }
      } catch (e) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
          }) + "\n"
        );
      }
    }
  })();
}
