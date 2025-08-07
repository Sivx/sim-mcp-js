import { extractToolsJson } from "./extractToolsJson.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const getCallerFile = () => {
  const thisFile = fileURLToPath(import.meta.url);
  const stack = new Error().stack?.split("\n") || [];
  for (const l of stack) {
    const m = l.match(/\((.*):\d+:\d+\)/) || l.match(/at (.*):\d+:\d+/);
    const f = m && m[1];
    if (f && f !== thisFile && !f.endsWith("/server/assistant.js")) return f;
  }
  throw new Error("Could not determine caller file");
};

export const toolsJson = (fns?: Function[]) => {
  const src = readFileSync(getCallerFile(), "utf8");
  const schemas = extractToolsJson(src, { flattenSingleObjectParam: true });
  const fnMap = new Map(
    (fns || Object.values(globalThis))
      .filter((f) => typeof f === "function")
      .map((f) => [f.name, f])
  );
  return (fns ? schemas.filter((t) => fnMap.has(t.name)) : schemas).map(
    (schema) => ({ ...schema, fn: fnMap.get(schema.name) })
  );
};
