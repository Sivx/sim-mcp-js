import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";
import { z } from "zod";

it("parses required enum", () => {
  const p = parseParams(["fruit!{apple,banana,pear}@Pick a fruit"]);
  // Check type (unwraps optional/default)
  expect(getZodBaseType(p.fruit)).toBe("ZodEnum");
  // Check it is actually required (undefined is not allowed)
  expect(p.fruit.safeParse(undefined).success).toBe(false);
  // Check options
  expect(p.fruit.options).toEqual(["apple", "banana", "pear"]);
  expect(p.fruit._def.description).toContain("Choices: apple, banana, pear");
  // Valid and invalid values
  expect(() => p.fruit.parse("orange")).toThrow();
  expect(p.fruit.parse("banana")).toBe("banana");
});

function getZodEnumValues(sch) {
  let t = sch;
  while (t._def.innerType) t = t._def.innerType;
  return t._def.values;
}

it("parses optional enum", () => {
  const p = parseParams(["mode:{auto,manual}@Choose mode"]);
  expect(getZodEnumValues(p.mode)).toEqual(["auto", "manual"]);
  expect(p.mode.isOptional()).toBe(true);
  expect(p.mode._def.description).toContain("Choices: auto, manual");
  expect(p.mode.parse("auto")).toBe("auto");
  expect(p.mode.parse(undefined)).toBeUndefined();
});

it("parses enum with default", () => {
  const p = parseParams(["mode:{auto,manual}=manual@Mode with default"]);
  expect(getZodEnumValues(p.mode)).toEqual(["auto", "manual"]);
  expect(p.mode.isOptional()).toBe(true);
  // Check the default, which is a function in Zod
  expect(typeof p.mode._def.defaultValue).toBe("function");
  expect(p.mode._def.defaultValue()).toBe("manual");
  // Accepts default
  expect(p.mode.parse(undefined)).toBe("manual");
  // Accepts valid values
  expect(p.mode.parse("auto")).toBe("auto");
  // Rejects invalid
  expect(() => p.mode.parse("xyz")).toThrow();
});

it("parses enum with both required and default as optional", () => {
  const p = parseParams(["env!:{dev,prod}=dev@Env"]);
  expect(getZodEnumValues(p.env)).toEqual(["dev", "prod"]);
  // Default always makes it optional in Zod
  expect(p.env.isOptional()).toBe(true);
  expect(p.env._def.defaultValue()).toBe("dev");
  expect(p.env.parse(undefined)).toBe("dev");
});

it("throws on invalid enum value", () => {
  const p = parseParams(["level:{low,medium,high}@Level"]);
  expect(() => p.level.parse("extreme")).toThrow();
});

it("error for invalid enum includes field name", () => {
  const p = parseParams(["level:{low,medium,high}@Level"]);
  const result = p.level.safeParse("extreme");
  expect(result.success).toBe(false);
  // Zod error path should include the field (here, it's top-level, so path is [])
  // For field-level test, use object schema:
  const objSchema = z.object({ level: p.level });
  const r2 = objSchema.safeParse({ level: "extreme" });
  expect(r2.success).toBe(false);
  // Check error path and message
  expect(r2.error.errors[0].path).toContain("level");
  expect(r2.error.errors[0].message).toMatch(/Invalid enum value/);
});

function getZodBaseType(sch) {
  let t = sch;
  while (t._def.innerType) t = t._def.innerType;
  return t._def.typeName;
}
