import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";

it("parses valid JSON object", () => {
  const p = parseParams(["data:json@JSON object"]);
  const val = { a: 1, b: "two", c: [3] };
  expect(p.data.parse(val)).toEqual(val);
});

it("parses valid JSON array", () => {
  const p = parseParams(["items:json@JSON array"]);
  const val = [1, 2, 3];
  expect(p.items.parse(val)).toEqual(val);
});

it("rejects invalid JSON (string)", () => {
  const p = parseParams(["data:json@JSON object"]);
  expect(() => p.data.parse("not json")).toThrow();
});

it("rejects invalid JSON (number)", () => {
  const p = parseParams(["data:json@JSON object"]);
  expect(() => p.data.parse(123)).toThrow();
});
