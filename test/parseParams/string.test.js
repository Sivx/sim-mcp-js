import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";

it("parses required string", () => {
  const p = parseParams(["name!:string@Required name"]);
  expect(
    p.name._def.typeName === "ZodString" ||
      p.name._def.innerType?._def.typeName === "ZodString"
  ).toBe(true);
  expect(p.name.safeParse(undefined).success).toBe(false);
  expect(p.name.parse("hello")).toBe("hello");
});

it("parses optional string", () => {
  const p = parseParams(["nickname:string@Nickname"]);
  expect(p.nickname.isOptional()).toBe(true);
  expect(p.nickname.parse(undefined)).toBeUndefined();
  expect(p.nickname.parse("Dan")).toBe("Dan");
});

it("parses string with default", () => {
  const p = parseParams(["greeting:string=hi@Greeting"]);
  expect(p.greeting.isOptional()).toBe(true);
  expect(typeof p.greeting._def.defaultValue).toBe("function");
  expect(p.greeting._def.defaultValue()).toBe("hi");
  expect(p.greeting.parse(undefined)).toBe("hi");
  expect(p.greeting.parse("hey")).toBe("hey");
});

it("parses string with regex", () => {
  const p = parseParams(["zipcode!:/^\\d{5}$/@Zip code"]);
  expect(p.zipcode.safeParse("12345").success).toBe(true);
  expect(p.zipcode.safeParse("abcde").success).toBe(false);
  expect(p.zipcode.safeParse(undefined).success).toBe(false);
});

it("throws for missing required string", () => {
  const p = parseParams(["username!:string@Username"]);
  expect(() => p.username.parse(undefined)).toThrow();
});

it("throws for value not matching regex", () => {
  const p = parseParams(["zipcode!:/^\\d{5}$/@Zip code"]);
  expect(() => p.zipcode.parse("abc")).toThrow();
  expect(() => p.zipcode.parse("1234")).toThrow();
  expect(() => p.zipcode.parse("123456")).toThrow();
});

it("throws for wrong type (number for string)", () => {
  const p = parseParams(["city:string@City"]);
  expect(() => p.city.parse(123)).toThrow();
});
