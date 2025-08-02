import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";

it("parses default value", () => {
  const p = parseParams(["color=red@Favorite color"]);
  expect(p.color.isOptional()).toBe(true);
  expect(typeof p.color._def.defaultValue).toBe("function");
  expect(p.color._def.defaultValue()).toBe("red");
  expect(p.color.parse(undefined)).toBe("red");
  expect(p.color.parse("blue")).toBe("blue");
});

it("parses numeric default value", () => {
  const p = parseParams(["count:int=10@Count value"]);
  expect(p.count.isOptional()).toBe(true);
  expect(typeof p.count._def.defaultValue).toBe("function");
  expect(p.count._def.defaultValue()).toBe(10);
  expect(p.count.parse(undefined)).toBe(10);
  expect(p.count.parse(20)).toBe(20);
});

it("parses boolean default value", () => {
  const p = parseParams(["enabled:boolean=true@Enabled flag"]);
  expect(p.enabled.isOptional()).toBe(true);
  expect(typeof p.enabled._def.defaultValue).toBe("function");
  expect(p.enabled._def.defaultValue()).toBe(true);
  expect(p.enabled.parse(undefined)).toBe(true);
  expect(p.enabled.parse(false)).toBe(false);
});

it("parses string default with spaces", () => {
  const p = parseParams(["status=active user@User status"]);
  expect(p.status.isOptional()).toBe(true);
  expect(p.status.parse(undefined)).toBe("active user");
  expect(p.status.parse("inactive")).toBe("inactive");
});

it("parses default without type (defaults to string)", () => {
  const p = parseParams(["nickname=guest@User nickname"]);
  expect(p.nickname.isOptional()).toBe(true);
  expect(p.nickname.parse(undefined)).toBe("guest");
  expect(p.nickname.parse("john")).toBe("john");
});
