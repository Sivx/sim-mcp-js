#!/usr/bin/env tsx
import path from "path";
import { pathToFileURL } from "url";
import { extractToolsJson } from "./extractToolsJson.js"; // Adjust path as needed
import fs from "fs/promises";

function parseVal(val: string) {
  if (val === "-" || val === "" || val === "undefined") return undefined;
  if (val === "true") return true;
  if (val === "false") return false;
  if (!isNaN(Number(val))) return Number(val);
  try {
    return JSON.parse(val);
  } catch {}
  return val;
}

function parseNamedArgs(args: string[]) {
  const obj: Record<string, any> = {};
  for (const arg of args) {
    const [k, ...rest] = arg.split("=");
    if (rest.length > 0) obj[k] = parseVal(rest.join("="));
  }
  return obj;
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    console.log(`Usage: sim-mcp <file.ts> <function> [args...]
           sim-mcp <file.ts> --tools
Examples:
  sim-mcp types.ts foo bob 22 true
  sim-mcp types.ts foo name=bob admin=true
  sim-mcp types.ts --tools

Notes:
- For single-object-parameter functions, use key=val args.
- For positional args, use '-' to skip (pass undefined).
- Use --tools to print MCP tools.json schema for your file.
`);
    process.exit(0);
  }

  const [fileArg, fnName, ...args] = argv;

  if (!fileArg?.endsWith(".ts") && !fileArg?.endsWith(".js")) {
    console.error("First arg must be your .ts or .js file.");
    process.exit(1);
  }

  // If --tools, print tools.json and exit
  if (argv.includes("--tools")) {
    const src = await fs.readFile(fileArg, "utf8");
    const tools = extractToolsJson(src, { flattenSingleObjectParam: true });
    console.log(JSON.stringify(tools, null, 2));
    process.exit(0);
  }

  if (!fnName || fnName.startsWith("--")) {
    console.error("You must specify a function to call.");
    process.exit(1);
  }

  const fileAbs = path.isAbsolute(fileArg)
    ? fileArg
    : path.resolve(process.cwd(), fileArg);
  const modPath = pathToFileURL(fileAbs).href;

  let mod;
  try {
    mod = await import(modPath);
  } catch (err) {
    console.error("Failed to import:", err);
    process.exit(1);
  }
  const fn = mod[fnName];
  if (typeof fn !== "function") {
    console.error(`No exported function "${fnName}" found in ${fileArg}`);
    process.exit(1);
  }

  const allNamed = args.length && args.every((a) => a.includes("="));
  let result;
  try {
    if (allNamed) {
      result = await fn(parseNamedArgs(args));
    } else if (args.length) {
      result = await fn(...args.map(parseVal));
    } else {
      result = await fn();
    }
    console.log(result);
  } catch (err) {
    console.error("Error calling function:", err);
    process.exit(1);
  }
}

main();
