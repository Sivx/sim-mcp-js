import { describe, it, expect } from "vitest";
import { spawn } from "child_process";

function callTestTypes(params) {
  return new Promise((resolve) => {
    const cp = spawn("node", ["index.js"], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    cp.stdout.setEncoding("utf8");
    let output = "";
    cp.stdout.on("data", (chunk) => (output += chunk));

    const req = {
      jsonrpc: "2.0",
      id: "test_types_1",
      method: "tools/call",
      params: {
        name: "testTypes",
        arguments: params,
      },
    };

    cp.stdin.write(JSON.stringify(req) + "\n");
    cp.stdin.end();

    cp.on("close", () => {
      const respStr = output.split("\n").filter(Boolean)[0];
      try {
        resolve(JSON.parse(respStr));
      } catch {
        resolve({ error: "invalid json", raw: output });
      }
    });
  });
}

describe("testTypes tool", () => {
  it("accepts valid full input", async () => {
    const result = await callTestTypes({
      fruit: "banana",
      age: 27,
      active: true,
      score: 8.5,
      items: ["apple", "pear"],
      note: "test note",
      mode: "auto",
      country: "US",
      zip: "12345",
      size: "3",
      favoriteColor: "green",
    });
    console.log("Result:", result);
    expect(result.json).toMatchObject({
      fruit: "banana",
      age: 27,
      active: true,
      score: 8.5,
      items: ["apple", "pear"],
      note: "test note",
      mode: "auto",
      country: "US",
      zip: "12345",
      size: "3",
      favoriteColor: "green",
    });
  });

  it("uses defaults and validates enums/regex", async () => {
    const result = await callTestTypes({
      fruit: "apple",
      mode: "manual",
      country: "FR",
      zip: "54321",
    });
    expect(result.json).toMatchObject({
      fruit: "apple",
      score: 5,
      mode: "manual",
      country: "FR",
      zip: "54321",
      size: "2", // as string
      favoriteColor: "blue", // as string
    });
  });

  it("fails for invalid enum", async () => {
    const result = await callTestTypes({
      fruit: "invalidfruit",
      mode: "auto",
      country: "US",
      zip: "12345",
    });
    expect(result.error || result.result?.error).toBeTruthy();
  });

  it("fails for invalid zip", async () => {
    const result = await callTestTypes({
      fruit: "pear",
      mode: "auto",
      country: "US",
      zip: "notazip",
    });
    expect(result.error || result.result?.error).toBeTruthy();
  });
});
