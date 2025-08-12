import dotenv from "dotenv";
dotenv.config(process.env.SIM_MCP_ENV);
import { pathToFileURL } from "url";
import path from "path";

import "./sim-mcp-library/stdio.js";
import { toolsJson } from "./sim-mcp-library/inline-tools.js";
import { ChatAssistant } from "./sim-mcp-library/assistant.js";

function isMCP() {
  return !process.stdin.isTTY || !process.stdout.isTTY;
}

function isCli() {
  if (isMCP()) return false;
  const entry = process.argv[1]
    ? pathToFileURL(process.argv[1]).href.toLowerCase()
    : "";
  const frames = (new Error().stack || "").split("\n").slice(2); // skip "Error" and this fn
  for (const line of frames) {
    const m = line.match(/(file:\/\/\S+|[A-Za-z]:\\[^:]+):\d+:\d+/);
    if (!m) continue;
    const href = m[1].startsWith("file://") ? m[1] : pathToFileURL(m[1]).href;
    if (href.toLowerCase() === entry) return true;
    return false; // only check the immediate caller
  }
  return false;
}

export { toolsJson, ChatAssistant, isMCP, isCli };
export default { toolsJson, ChatAssistant, isMCP, isCli };
