function parseKey(k) {
  let m = k.match(/^(.+?)\s*@\s*(.+)$/);
  return m
    ? { name: m[1].trim(), description: m[2].trim() }
    : { name: k.trim(), description: "" };
}

function prompt(tools) {
  return Object.entries(tools)
    .map(([tk, tf]) => {
      const { name, description } = parseKey(tk);
      const paramsArr = tf._toolParams
        ? Object.entries(tf._toolParams)
            .sort(([a, b]) => a.localeCompare(b))
            .map(([param, zod]) => ({ param, zod }))
        : [];
      const paramsSig = paramsArr
        .map(({ param, zod }) => {
          let t =
            zod._def?.typeName?.replace(/^Zod/, "").toLowerCase() || "string";
          let opt = zod.isOptional?.() ?? false;
          return `${param}${opt ? "?" : ""}: ${t}`;
        })
        .join(", ");
      const docLines = paramsArr.map(
        ({ param, zod }) => `- ${param}: ${zod?._def?.description || ""}`
      );
      return [
        `${name}(${paramsSig}) -> text`,
        description && `@${description}`,
        ...docLines,
        "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

function mcpToolsJson(tools) {
  function unwrapZod(zod) {
    while (
      ["ZodDefault", "ZodOptional", "ZodNullable"].includes(zod._def.typeName)
    ) {
      zod = zod._def.innerType;
    }
    return zod;
  }
  function isAllInt(values) {
    return values.every(
      (v) =>
        typeof v === "number" ||
        (!isNaN(Number(v)) && String(Number(v)) === String(Number(v)))
    );
  }
  function toEnum(values, type) {
    if (type === "integer" && isAllInt(values)) {
      return values.map((v) => (typeof v === "number" ? v : Number(v)));
    }
    return values;
  }
  return Object.entries(tools).map(([tk, tf]) => {
    const { name, description } = parseKey(tk);
    const zParams = tf._toolParams || {};
    const properties = {};
    const required = [];
    for (const [param, zodOrig] of Object.entries(zParams)) {
      let zod = unwrapZod(zodOrig);
      const def = zod._def;
      let type =
        def.typeName === "ZodString"
          ? "string"
          : def.typeName === "ZodNumber"
          ? Array.isArray(def.checks) &&
            def.checks.some((c) => c.kind === "int")
            ? "integer"
            : "number"
          : def.typeName === "ZodBoolean"
          ? "boolean"
          : def.typeName === "ZodArray"
          ? "array"
          : def.typeName === "ZodObject"
          ? "object"
          : def.typeName === "ZodEnum" || def.typeName === "ZodNativeEnum"
          ? def.values && isAllInt(def.values)
            ? "integer"
            : "string"
          : def.typeName === "ZodLiteral"
          ? typeof def.value
          : "string";
      const prop = { type };
      if (def.description) prop.description = def.description;
      if (def.values) prop.enum = toEnum(def.values, type);
      if (def.typeName === "ZodNativeEnum" && def.values)
        prop.enum = toEnum(Object.values(def.values), type);
      let defaultVal;
      let outer = zodOrig;
      while (outer && outer._def && outer._def.typeName === "ZodDefault") {
        defaultVal = outer._def.defaultValue;
        outer = outer._def.innerType;
      }
      if (typeof defaultVal === "function") defaultVal = defaultVal();
      if (defaultVal !== undefined && defaultVal !== null) {
        if (type === "number" || type === "integer") {
          const n = Number(defaultVal);
          if (!isNaN(n)) prop.default = n;
        } else {
          prop.default = defaultVal;
        }
      }
      if (def.typeName === "ZodString" && Array.isArray(def.checks)) {
        for (const check of def.checks) {
          if (check.kind === "regex" && check.regex)
            prop.pattern = check.regex.source;
        }
      }
      if (def.typeName === "ZodArray" && def.type) {
        let inner = unwrapZod(def.type);
        let innerType =
          inner._def.typeName === "ZodString"
            ? "string"
            : inner._def.typeName === "ZodNumber"
            ? "number"
            : inner._def.typeName === "ZodBoolean"
            ? "boolean"
            : "string";
        prop.items = { type: innerType };
      }
      properties[param] = prop;
      if (!(zodOrig.isOptional?.() || zodOrig.isNullable?.()))
        required.push(param);
    }
    return {
      name,
      description,
      inputSchema: {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
      },
    };
  });
}

export { parseKey, prompt, mcpToolsJson };
