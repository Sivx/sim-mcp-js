import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";
import { z } from "zod";

it("parses required regex", () => {
  const p = parseParams(["zip!:/^\\d{5}$/@Zip"]);
  expect(p.zip.safeParse("12345").success).toBe(true);
  expect(() => p.zip.parse("1234")).toThrow();
  expect(() => p.zip.parse("abcde")).toThrow();
  expect(() => p.zip.parse(undefined)).toThrow();
});

it("parses optional regex", () => {
  const p = parseParams(["ext:/^\\w{3,4}$/@File extension"]);
  expect(p.ext.isOptional()).toBe(true);
  expect(p.ext.parse(undefined)).toBeUndefined();
  expect(p.ext.parse("txt")).toBe("txt");
  expect(() => p.ext.parse("toolong")).toThrow();
});
it("parses regex with default", () => {
  const p = parseParams(["region:/^[A-Z]{2}$/=US@Region"]);

  expect(p.region.parse(undefined)).toBe("US");
  expect(p.region.parse("CA")).toBe("CA");

  function unwrap(schema) {
    while (
      schema._def &&
      (schema._def.typeName === "ZodOptional" ||
        schema._def.typeName === "ZodDefault" ||
        schema._def.typeName === "ZodNullable")
    ) {
      schema = schema._def.innerType;
    }
    return schema;
  }

  const innerSchema = unwrap(p.region);

  const regexCheck = (innerSchema._def.checks || []).find(
    (c) => c.kind === "regex"
  );
  expect(regexCheck).toBeDefined();
  expect(regexCheck.regex.source).toBe("^[A-Z]{2}$");

  expect(() => p.region.parse("cali")).toThrow(z.ZodError);
});

it("throws for number or bool in regex param", () => {
  const p = parseParams(["code:/^\\w{6}$/@Invite code"]);
  expect(() => p.code.parse(123456)).toThrow();
  expect(() => p.code.parse(true)).toThrow();
});

function isZodOptionalOrDefault(sch) {
  let t = sch;
  while (t._def.innerType) t = t._def.innerType;
  return (
    sch.isOptional?.() === true ||
    sch._def.typeName === "ZodDefault" ||
    sch._def.typeName === "ZodOptional"
  );
}

it("valid inputs match regex", () => {
  const p = parseParams(["region:/^[A-Z]{2}$/=US@Region"]);
  expect(p.region.parse("NY")).toBe("NY");
  expect(p.region.parse("CA")).toBe("CA");
});

it("invalid inputs throw", () => {
  const p = parseParams(["region:/^[A-Z]{2}$/=US@Region"]);
  const innerSchema =
    p.region._def.innerType._def.innerType || p.region._def.innerType;
  expect(() => innerSchema.parse("NewYork")).toThrow(z.ZodError);
});

it("default value applies when undefined", () => {
  const p = parseParams(["region:/^[A-Z]{2}$/=US@Region"]);
  expect(p.region.parse(undefined)).toBe("US");
});

it("regex with flags works", () => {
  const p = parseParams(["code:/^[a-z]{3}$/i=abc"]);
  expect(p.code.parse("XYZ")).toBe("XYZ");
  expect(() => p.code.parse("XY1")).toThrow(z.ZodError);
});

it("optional regex param without default", () => {
  const p = parseParams(["tag:/^tag[0-9]+$/"]);
  expect(p.tag.parse(undefined)).toBeUndefined();
  expect(p.tag.parse("tag123")).toBe("tag123");
  const innerSchema =
    p.tag._def.innerType._def.innerType || p.tag._def.innerType;
  expect(() => innerSchema.parse("nope")).toThrow(z.ZodError);
});

it("no regex param behaves normally", () => {
  const p = parseParams(["name:string=John"]);
  expect(p.name.parse(undefined)).toBe("John");
  expect(p.name.parse("Jane")).toBe("Jane");
});
