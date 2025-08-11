import { extractToolsJson } from "./extractToolsJson.js";
import { readFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import { createRequire } from "module";

const requireFn = createRequire(import.meta.url);

const importRe = /\bimport\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"]/gm;

function parseImports(src) {
  const map = new Map();
  let m;
  while ((m = importRe.exec(src))) {
    const clause = m[1].trim();
    const spec = m[2];
    if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
    const def = clause.match(/^([A-Za-z_$][\w$]*)/);
    if (def) map.set(def[1], { spec, kind: "default" });
    const named = clause.match(/\{([^}]+)\}/);
    if (named) {
      for (const part of named[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        const [imported, local = imported] = part
          .split(/\s+as\s+/)
          .map((s) => s.trim());
        map.set(local, { spec, kind: "named", imported });
      }
    }
  }
  return map;
}

function getCallerFile() {
  const thisFile = fileURLToPath(import.meta.url);
  const stack = new Error().stack?.split("\n") || [];
  for (const l of stack) {
    const m = l.match(/\((.*):\d+:\d+\)/) || l.match(/at (.*):\d+:\d+/);
    const f = m && m[1];
    if (f && f !== thisFile && !f.includes("/sim-mcp-library/")) return f;
  }
  throw new Error("Could not determine caller file");
}

export const toolsJson = (fns) => {
  const callerFile = getCallerFile();
  const callerSrc = readFileSync(callerFile, "utf8");
  const imports = parseImports(callerSrc);

  const srcByPath = new Map();
  const modCache = new Map();
  function abs(p) {
    return path.resolve(path.dirname(callerFile), p);
  }
  function loadMod(spec) {
    if (modCache.has(spec)) return modCache.get(spec);
    const full = abs(spec);
    const mod = requireFn(full);
    modCache.set(spec, mod);
    return mod;
  }
  function readSrc(spec) {
    const full = abs(spec);
    if (srcByPath.has(full)) return srcByPath.get(full);
    const src = readFileSync(full, "utf8");
    srcByPath.set(full, src);
    return src;
  }

  const baseSchemas = extractToolsJson(callerSrc, {
    flattenSingleObjectParam: true,
  });

  const importSpecs = [...new Set([...imports.values()].map((i) => i.spec))];
  const importedSchemas = importSpecs.flatMap((spec) =>
    extractToolsJson(readSrc(spec), { flattenSingleObjectParam: true }).map(
      (s) => ({ ...s, __spec: spec })
    )
  );

  const allSchemas = [
    ...baseSchemas.map((s) => ({ ...s, __spec: null })),
    ...importedSchemas,
  ];

  const fnMap = new Map(
    (fns || Object.values(globalThis))
      .filter((f) => typeof f === "function")
      .map((f) => [f.name, f])
  );

  const byName = new Map();
  for (const s of allSchemas) if (!byName.has(s.name)) byName.set(s.name, s);

  return [...byName.values()]
    .map((s) => {
      let fn = fnMap.get(s.name);
      if (!fn) {
        if (s.__spec) {
          const mod = loadMod(s.__spec);
          const inv = [...imports.entries()].find(
            ([, v]) =>
              v.spec === s.__spec &&
              (v.kind === "default" ? "default" : v.imported) === s.name
          );
          if (inv)
            fn = inv[1].kind === "default" ? mod.default : mod[inv[1].imported];
          if (!fn) fn = mod[s.name];
        } else {
          const selfMod = requireFn(pathToFileURL(callerFile).toString());
          fn = selfMod[s.name];
        }
      }
      return { ...s, fn };
    })
    .filter((x) => typeof x.fn === "function")
    .map(({ __spec, ...rest }) => rest);
};
