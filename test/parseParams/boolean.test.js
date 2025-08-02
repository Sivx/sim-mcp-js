import { it, expect } from "vitest";
import { parseParams } from "../../sim-mcp.js";
it("parses boolean default", () => {
  const p = parseParams(["active:boolean=true@Active flag"]);
  expect(getZodBaseType(p.active)).toBe("ZodBoolean");
  expect(p.active.parse(undefined)).toBe(true);
  expect(p.active.parse(false)).toBe(false);
});

it("parses boolean false default", () => {
  const p = parseParams(["enabled:boolean=false@Enabled flag"]);
  expect(getZodBaseType(p.enabled)).toBe("ZodBoolean");
  expect(p.enabled.parse(undefined)).toBe(false);
  expect(p.enabled.parse(true)).toBe(true);
});

it("parses required boolean without default", () => {
  const p = parseParams(["flag!:boolean@Required flag"]);
  console.log("p.flag isOptional:", p.flag.isOptional()); // should be false
  expect(getZodBaseType(p.flag)).toBe("ZodBoolean");

  expect(() => p.flag.parse(undefined)).toThrow();
  expect(p.flag.parse(true)).toBe(true);
  expect(p.flag.parse(false)).toBe(false);
});

it("parses optional boolean without default", () => {
  const p = parseParams(["visible:boolean@Optional flag"]);
  expect(getZodBaseType(p.visible)).toBe("ZodBoolean");
  expect(p.visible.parse(undefined)).toBeUndefined();
  expect(p.visible.parse(true)).toBe(true);
});
function getZodBaseType(sch) {
  let t = sch;
  while (t && t._def && t._def.innerType) {
    t = t._def.innerType;
  }
  return t._def?.typeName;
}
