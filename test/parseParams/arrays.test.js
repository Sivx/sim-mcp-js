import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";
it("parses array of strings", () => {
  const p = parseParams(["tags:string[]@Tags"]);
  console.log("p");
  const typeName =
    p.tags._def.typeName === "ZodOptional"
      ? p.tags._def.innerType._def.typeName
      : p.tags._def.typeName;
  expect(typeName).toBe("ZodArray");
  expect(p.tags.parse(["a", "b", "c"])).toEqual(["a", "b", "c"]);
});

it("parses optional array", () => {
  const p = parseParams(["items:string[]@Optional items"]);
  expect(p.items.isOptional()).toBe(true);
  expect(p.items.parse(undefined)).toBeUndefined();
  expect(p.items.parse(["item1"])).toEqual(["item1"]);
});

it("parses array with default", () => {
  const p = parseParams(["list:number[]=[1,2,3]@Default list"]);
  expect(p.list.isOptional()).toBe(true);
  const defaultVal = p.list._def.defaultValue();
  expect(defaultVal).toEqual([1, 2, 3]);
  expect(p.list.parse(undefined)).toEqual([1, 2, 3]);
  expect(p.list.parse([4, 5])).toEqual([4, 5]);
});

it("parses array of numbers", () => {
  const p = parseParams(["nums:number[]@Numbers"]);
  expect(p.nums.isOptional()).toBe(true);
  expect(p.nums.parse(undefined)).toBeUndefined();
  expect(p.nums.parse([1, 2, 3])).toEqual([1, 2, 3]);
});
