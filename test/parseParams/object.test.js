import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";

it("parses object", () => {
  const p = parseParams(["settings:object@Settings"]);

  // Unwrap optional if present to get base schema typeName
  const typeName =
    p.settings._def.typeName === "ZodOptional"
      ? p.settings._def.innerType._def.typeName
      : p.settings._def.typeName;

  expect(typeName).toBe("ZodObject");

  const obj = { foo: "bar" };
  expect(p.settings.parse(obj)).toEqual(obj);
});

it("parses optional object", () => {
  const p = parseParams(["config:object@Config"]);
  expect(p.config.isOptional()).toBe(true);

  const typeName =
    p.config._def.typeName === "ZodOptional"
      ? p.config._def.innerType._def.typeName
      : p.config._def.typeName;
  expect(typeName).toBe("ZodObject");

  const obj = { enabled: true };
  expect(p.config.parse(obj)).toEqual(obj);
  expect(p.config.parse(undefined)).toBeUndefined();
});

function isReallyOptional(schema) {
  const { typeName } = schema._def;
  if (typeName === "ZodOptional" || typeName === "ZodDefault") return true;
  return false;
}

function getInnerTypeName(schema) {
  if (
    schema._def.typeName === "ZodDefault" ||
    schema._def.typeName === "ZodOptional"
  ) {
    return schema._def.innerType._def.typeName;
  }
  return schema._def.typeName;
}
it("parses object with default", () => {
  const p = parseParams(['prefs:object={ "theme": "dark" }@Preferences']);

  // Check if schema is optional or defaulted
  const isOptionalOrDefault =
    p.prefs._def.typeName === "ZodOptional" ||
    p.prefs._def.typeName === "ZodDefault";
  expect(isOptionalOrDefault).toBe(true);

  // Extract inner schema typeName properly
  const typeName = isOptionalOrDefault
    ? p.prefs._def.innerType._def.typeName
    : p.prefs._def.typeName;
  expect(typeName).toBe("ZodObject");

  const defaultVal = p.prefs._def.defaultValue
    ? p.prefs._def.defaultValue()
    : undefined;
  expect(defaultVal).toEqual({ theme: "dark" });

  expect(p.prefs.parse(undefined)).toEqual(defaultVal);
  expect(p.prefs.parse({ theme: "light" })).toEqual({ theme: "light" });
});
