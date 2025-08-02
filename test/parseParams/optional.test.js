import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";

it("parses optional string", () => {
  const p = parseParams(["note@Optional note"]);
  expect(p.note.isOptional()).toBe(true);
  expect(p.note.parse(undefined)).toBe(undefined);
  expect(p.note.parse("hello")).toBe("hello");
});

it("parses optional number", () => {
  const p = parseParams(["count:number@Optional count"]);
  expect(p.count.isOptional()).toBe(true);
  expect(p.count.parse(undefined)).toBe(undefined);
  expect(p.count.parse(42)).toBe(42);
});

it("parses optional boolean", () => {
  const p = parseParams(["flag:boolean@Optional flag"]);
  expect(p.flag.isOptional()).toBe(true);
  expect(p.flag.parse(undefined)).toBe(undefined);
  expect(p.flag.parse(true)).toBe(true);
});

it("parses optional enum", () => {
  const p = parseParams(["mode:string@Optional mode {auto, manual}"]);
  expect(p.mode.isOptional()).toBe(true);
  expect(p.mode.parse(undefined)).toBe(undefined);
  expect(p.mode.parse("auto")).toBe("auto");
});

it("parses optional regex", () => {
  const p = parseParams(["code:/^[A-Z]{3}$/@Optional code"]);
  expect(p.code.isOptional()).toBe(true);
  expect(p.code.parse(undefined)).toBe(undefined);
  expect(p.code.parse("ABC")).toBe("ABC");
});
