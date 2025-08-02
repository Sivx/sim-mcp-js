import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { Assistant } from "./assistant.js";
import { generateToolsJson, mapToolNameToFile } from "./generateToolsJson.js";
import { invokeTool } from "./raw.js";

import { map } from "zod/v4";

export async function run(dir = "./") {
  dotenv.config({ quiet: true });

  const absDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  generateToolsJson(absDir);
  const toolsPath = path.join(absDir, "tools.json");
  const toolsJson = await fs.readFile(toolsPath, "utf8");
  const rawTools = JSON.parse(toolsJson);
  // Generic callback for all function tool calls

  let mappedTools = mapToolNameToFile(absDir);
  let mappedToolsMemory = {};
  const functionHandler = async (toolName, args) => {
    if (!mappedTools[toolName])
      throw new Error(`Function ${toolName} is not registered.`);
    const toolPath = path.join(absDir, mappedTools[toolName]); // resolves to full path
    if (!mappedToolsMemory[toolName]) {
      mappedToolsMemory[toolName] = {};
    }
    let result = await invokeTool(
      toolName,
      args,
      toolPath,
      mappedToolsMemory[toolName]
    );
    console.log(`Tool ${toolName} called with args: ${JSON.stringify(args)}`);
    console.log(`Tool result:`, result);
    return result;
  };

  const tools = rawTools.map((t) => {
    return {
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    };
  });

  const rl = readline.createInterface({ input: stdin, output: stdout });
  rl.on("SIGINT", () => {
    rl.close();
    process.exit();
  });

  console.log("Tools: ", JSON.stringify(tools, null, 2));

  const assistant = new Assistant(tools, functionHandler);

  console.log("whoami:", await assistant.whoami());
  while (true) {
    let interval;
    let updating = false;

    // Wait for input
    const prompt = await rl.question("> ");

    if (prompt === ".exit") break;

    // If prompt is empty, enter interval update mode
    if (!prompt.trim()) {
      updating = true;
      //should print all the nodes.
      console.log("1. abc");
      console.log("2. def");
      console.log("3. ghi");
      interval = setInterval(() => {
        // Place your update logic here (status, agents, etc.)
        process.stdout.write(
          `\r[System update @ ${new Date().toLocaleTimeString()}] Press Enter to resume input...`
        );
      }, 500);

      // Wait for next enter to exit update mode
      await new Promise((resolve) => {
        rl.once("line", () => {
          updating = false;
          clearInterval(interval);
          process.stdout.write("\n"); // Move to next line after update
          resolve();
        });
      });
      continue; // Go back to next prompt
    }

    try {
      const res = await assistant.user(prompt);
      if (!res) {
        console.log("AI: [No assistant reply. Raw message list:]");
        const msgs = await assistant.client.beta.threads.messages.list(
          assistant.threadId
        );
        console.log(JSON.stringify(msgs.data, null, 2));
      } else if (res.content?.[0]?.text?.value) {
        console.log("AI:", res.content[0].text.value);
      } else {
        console.log("AI (raw):", res);
      }
    } catch (e) {
      console.error("Error:", e.message);
    }
  }

  rl.close();
}
