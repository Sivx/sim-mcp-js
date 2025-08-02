import { z } from "zod";

// Define or import your typeMap here
const typeMap = {
  string: () => z.string(),
  int: () => z.number().int(),
  number: () => z.number(),
  boolean: () => z.boolean(),
  object: () => z.object({}).passthrough(),
  json: () => z.string(),

  // Add others as needed
};
function splitParamAndDesc(str) {
  const [b, ...descArr] = str.split("@");
  return { b, descRaw: descArr.join("@") };
}

function parseRawParamAndType(b) {
  const colonIndex = b.indexOf(":");
  let rawParam, typ;
  if (colonIndex === -1) {
    rawParam = b.trim();
    typ = "";
  } else {
    rawParam = b.slice(0, colonIndex).trim();
    typ = b.slice(colonIndex + 1).trim();
  }
  return { rawParam, typ };
}

function parseRequired(rawParam) {
  const req = /!/.test(rawParam);
  return req;
}

function parseDefaultAndTypeFromRawParam(rawParam, typ) {
  let defVal;
  if (!typ && rawParam.includes("=")) {
    let [namePart, defRaw] = rawParam.split("=");
    rawParam = namePart.trim();
    defVal = defRaw;
    typ = "string";
  }
  if (!typ) typ = "string";
  if (defVal !== undefined && typ === "object" && typeof defVal === "string") {
    try {
      defVal = JSON.parse(defVal);
    } catch {
      // leave as string if parse fails
    }
  }
  return { rawParam, typ, defVal };
}

function parseRegex(typ) {
  const regexMatch = typ.match(/^\/(.+?)\/([a-z]*)/);
  let isRegex = false;
  let regex;
  let defVal;
  if (regexMatch) {
    isRegex = true;
    regex = new RegExp(regexMatch[1], regexMatch[2]);
    const afterRegex = typ.slice(regexMatch[0].length);
    if (afterRegex.startsWith("=")) defVal = afterRegex.slice(1);
    typ = "string";
  }
  return { typ, isRegex, regex, defVal };
}

function parseDefaultFromType(typ, prevDefVal) {
  let defVal = prevDefVal;
  if (!defVal && typ.includes("=")) {
    let [baseType, defRaw] = typ.split("=");
    typ = baseType.trim();
    defVal = defRaw;
  }
  return { typ, defVal };
}
function extractEnumValues(b, descRaw, isRegex, typ) {
  if (isRegex) return null;
  if (typ === "object" || typ.endsWith("[]")) return null; // skip enums for objects and arrays
  const paramForEnum = b.replace(/\/[^\/]+\/[a-z]*/g, "");
  const enumMatch = (paramForEnum + " " + descRaw).match(/\{([^}]+)\}/);
  return enumMatch ? enumMatch[1].split(",").map((s) => s.trim()) : null;
}

function cleanParamName(rawParam) {
  return rawParam
    .replace(/!/, "")
    .replace(/\{.*?\}/g, "")
    .trim();
}

function cleanDescription(descRaw) {
  return descRaw.replace(/\{.*?\}/g, "").trim();
}
function coerceDefaultValue(defVal, typ) {
  if (defVal === undefined) return defVal;
  if (typ === "int" || typ === "number") return Number(defVal);
  if (typ === "boolean") return defVal === "true";
  if (typ === "object") {
    try {
      if (typeof defVal === "string") return JSON.parse(defVal);
      return defVal;
    } catch {
      return defVal;
    }
  }
  if (typ.endsWith("[]")) {
    try {
      return JSON.parse(defVal);
    } catch {
      return defVal;
    }
  }
  return defVal;
}

function buildSchema(typ, defVal, isRegex, regex, enumVals, req) {
  const { isArray, elementType } = parseArrayType(typ);
  if (isArray) {
    const elemSch = (typeMap[elementType] || z.string)();
    let sch = z.array(elemSch);
    if (defVal !== undefined) {
      sch = sch.default(defVal); // just .default(), no .optional()
    } else if (!req) {
      sch = sch.optional();
    }
    return sch;
  }

  if (isRegex) {
    let sch = z.string().regex(regex);
    if (defVal !== undefined) return sch.default(defVal);
    if (!req) return sch.optional();
    return sch;
  }

  if (enumVals) {
    // Accept both numbers and strings
    const numberLiterals = enumVals
      .filter((v) => !isNaN(v) && v !== "")
      .map((v) => z.literal(Number(v)));
    const stringLiterals = enumVals.map((v) => z.literal(String(v)));
    let sch = z.union([...numberLiterals, ...stringLiterals]);
    if (defVal !== undefined) return sch.default(defVal);
    if (!req) return sch.optional();
    return sch;
  }

  let sch = (typeMap[typ] || z.string)();
  if (defVal !== undefined) return sch.default(defVal);
  else if (!req) return sch.optional();

  return sch;
}
function buildDescription(sch, desc, enumVals, defVal, isRegex, regex) {
  const parts = [];
  if (desc) parts.push(desc);
  if (enumVals) parts.push(`Choices: ${enumVals.join(", ")}`);
  if (defVal !== undefined) parts.push(`(default: ${defVal})`);
  if (isRegex) parts.push(`Regex: /${regex.source}/`);
  const fullDesc = parts.join(" ").trim();
  if (fullDesc) sch = sch.describe(fullDesc);
  return sch;
}

function parseParams(arr) {
  return Object.fromEntries(
    arr.map((e) => {
      const { b, descRaw } = splitParamAndDesc(e);
      let { rawParam, typ } = parseRawParamAndType(b);
      const req = parseRequired(rawParam);
      let defVal;
      ({ rawParam, typ, defVal } = parseDefaultAndTypeFromRawParam(
        rawParam,
        typ
      ));
      let regexData = parseRegex(typ);
      typ = regexData.typ;
      if (regexData.defVal !== undefined) defVal = regexData.defVal;
      const defaultData = parseDefaultFromType(typ, defVal);
      typ = defaultData.typ;
      defVal = defaultData.defVal;
      const enumVals = extractEnumValues(b, descRaw, regexData.isRegex, typ);
      const paramName = cleanParamName(rawParam);
      const desc = cleanDescription(descRaw);
      const coercedDefVal = coerceDefaultValue(defVal, typ);
      let sch = buildSchema(
        typ,
        coercedDefVal,
        regexData.isRegex,
        regexData.regex,
        enumVals,
        req
      );
      sch = buildDescription(
        sch,
        desc,
        enumVals,
        coercedDefVal,
        regexData.isRegex,
        regexData.regex
      );
      return [paramName, sch];
    })
  );
}

function parseArrayType(typ) {
  // Match `elementType[]` syntax like 'string[]', 'int[]'
  const bracketMatch = typ.match(/^(.+)\[\]$/);
  if (bracketMatch) {
    return {
      isArray: true,
      elementType: bracketMatch[1].trim(),
    };
  }

  return { isArray: false, elementType: null };
}

export { parseParams };
