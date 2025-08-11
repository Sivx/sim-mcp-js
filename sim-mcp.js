import dotenv from "dotenv";
dotenv.config();

import "./sim-mcp-library/stdio.js";
import { toolsJson } from "./sim-mcp-library/inline-tools.js";
import { ChatAssistant } from "./sim-mcp-library/assistant.js";

function isMCP() {
  return !process.stdin.isTTY || !process.stdout.isTTY;
}

let firstRun = true;
function isCli() {
  if (firstRun) {
    firstRun = false;
  }
  return !isMCP();
}

export { toolsJson, ChatAssistant, isMCP, isCli };
export default { toolsJson, ChatAssistant, isMCP, isCli };
