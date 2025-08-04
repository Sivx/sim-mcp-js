import dotenv from "dotenv";
dotenv.config();

import "./server/stdio.js";
import { toolsJson } from "./server/inline-tools.js";
import { ChatAssistant } from "./server/assistant.js";

function isMCP() {
  return !process.stdin.isTTY || !process.stdout.isTTY;
}

export { toolsJson, ChatAssistant, isMCP };
export default { toolsJson, ChatAssistant, isMCP };
