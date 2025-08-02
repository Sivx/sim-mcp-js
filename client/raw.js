import fs from "fs";
import readline from "readline";
import { spawn } from "child_process";
import path from "path";

export async function invokeTool(
  toolName,
  toolArgs = {},
  serverPath = "./test_server.js",
  memory = {}
) {
  let env = { SIM_MCP_RUN: "1" };
  const base = path.basename(serverPath, path.extname(serverPath));
  const envFile = path.join(path.dirname(serverPath), base + ".env");
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, "utf-8").split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
  const command = serverPath.endsWith(".js") ? "node" : serverPath;
  const args = serverPath.endsWith(".js") ? [serverPath] : [];
  const proc = spawn(command, args, {
    stdio: ["pipe", "pipe", "inherit", "ipc"],
    env: env,
  });

  proc.send(memory);

  proc.on("message", (msg) => {
    for (const [key, value] of Object.entries(msg)) {
      memory[key] = value;
    }
  });

  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: toolName, arguments: toolArgs },
  };
  proc.stdin.write(JSON.stringify(request) + "\n");

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      try {
        const resp = JSON.parse(line);
        rl.close();
        proc.kill();
        if (resp.error) reject(resp.error);
        else resolve(resp.result);
      } catch {}
    });
    proc.on("error", reject);
  });
}
