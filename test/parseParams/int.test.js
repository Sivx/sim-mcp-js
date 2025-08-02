import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";

it("parses required int", () => {
  const p = parseParams(["age!:int@Age"]);
  // Required, must be an int
  expect(p.age.safeParse(undefined).success).toBe(false);
  expect(p.age.parse(23)).toBe(23);
  expect(() => p.age.parse("23")).toThrow();
  expect(() => p.age.parse(3.5)).toThrow();
});

it("parses optional int", () => {
  const p = parseParams(["score:int@Score"]);
  expect(p.score.isOptional()).toBe(true);
  expect(p.score.parse(undefined)).toBeUndefined();
  expect(p.score.parse(0)).toBe(0);
});

it("parses int with default", () => {
  const p = parseParams(["level:int=5@Level"]);
  expect(p.level.isOptional()).toBe(true);
  expect(p.level._def.defaultValue()).toBe(5);
  expect(p.level.parse(undefined)).toBe(5);
  expect(p.level.parse(10)).toBe(10);
});

it("throws for float value", () => {
  const p = parseParams(["round:int@Round"]);
  expect(() => p.round.parse(2.5)).toThrow();
});

it("throws for string value", () => {
  const p = parseParams(["count:int@Count"]);
  expect(() => p.count.parse("five")).toThrow();
});
