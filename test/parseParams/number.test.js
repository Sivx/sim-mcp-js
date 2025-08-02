import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";

it("parses required number", () => {
  const p = parseParams(["height!:number@Height"]);
  expect(p.height.safeParse(undefined).success).toBe(false);
  expect(p.height.parse(172)).toBe(172);
  expect(p.height.parse(172.5)).toBe(172.5);
});

it("parses optional number", () => {
  const p = parseParams(["weight:number@Weight"]);
  expect(p.weight.isOptional()).toBe(true);
  expect(p.weight.parse(undefined)).toBeUndefined();
  expect(p.weight.parse(0)).toBe(0);
});

it("parses number with default", () => {
  const p = parseParams(["score:number=5.5@Score"]);
  expect(p.score.isOptional()).toBe(true);
  expect(p.score._def.defaultValue()).toBe(5.5);
  expect(p.score.parse(undefined)).toBe(5.5);
  expect(p.score.parse(1.2)).toBe(1.2);
});

it("throws for string value", () => {
  const p = parseParams(["depth:number@Depth"]);
  expect(() => p.depth.parse("ten")).toThrow();
});

it("throws for NaN", () => {
  const p = parseParams(["value:number@Value"]);
  expect(() => p.value.parse(NaN)).toThrow();
});
