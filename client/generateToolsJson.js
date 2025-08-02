import fs from "fs";
import path from "path";

const mcpRegex = /\/\*\s*mcp v2 json\s*([\s\S]*?)\s*\*\//gi;

function collectToolsJson(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
  const blocks = [];
  files.forEach((f) => {
    const c = fs.readFileSync(path.join(dir, f), "utf8");
    const matches = c.match(mcpRegex);
    if (matches) {
      matches.forEach((b) => {
        const block = b.replace(/\/\*\s*mcp v2 json|\*\//gi, "").trim();
        try {
          const obj = JSON.parse(block);
          if (Array.isArray(obj)) {
            blocks.push(...obj);
          } else {
            blocks.push(obj);
          }
        } catch (e) {
          // ignore invalid blocks
        }
      });
    }
  });
  return blocks;
}

export function generateToolsJson(targetDir) {
  const tools = collectToolsJson(targetDir);
  if (!tools.length) return;
  fs.writeFileSync(
    path.join(targetDir, "tools.json"),
    JSON.stringify(tools, null, 2),
    "utf8"
  );
}

export function mapToolNameToFile(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
  const mapping = {};
  files.forEach((f) => {
    const relPath = "./" + path.relative(dir, path.join(dir, f));
    const c = fs.readFileSync(path.join(dir, f), "utf8");
    const matches = c.match(mcpRegex);
    if (matches) {
      matches.forEach((b) => {
        const block = b.replace(/\/\*\s*mcp v2 json|\*\//gi, "").trim();
        try {
          const obj = JSON.parse(block);
          const arr = Array.isArray(obj) ? obj : [obj];
          arr.forEach((o) => {
            if (o.name) mapping[o.name] = relPath;
          });
        } catch {}
      });
    }
  });
  return mapping;
}
