import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import fetch from "node-fetch";

let serverProcess;
let sessionId;

const MCP_PORT = "3000";

beforeAll(async () => {
  // Start the server with MCP_PORT set
  serverProcess = spawn(process.execPath, ["index.js"], {
    env: { ...process.env, MCP_PORT },
    stdio: "inherit",
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Step 1: Initialize and get sessionId
  const initReq = {
    jsonrpc: "2.0",
    id: "init1",
    method: "initialize",
    params: {},
  };
  const resp = await fetch(`http://localhost:${MCP_PORT}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(initReq),
  });
  sessionId = resp.headers.get("mcp-session-id");
  console.log("SessionId received:", sessionId);
  if (!sessionId) throw new Error("No sessionId returned from MCP server");
});

afterAll(() => {
  serverProcess.kill();
});

async function callTestTypesHTTP(params) {
  const req = {
    jsonrpc: "2.0",
    id: "test_types_1",
    method: "tools/call",
    params: {
      name: "testTypes",
      arguments: params,
    },
  };
  const resp = await fetch(`http://localhost:${MCP_PORT}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "mcp-session-id": sessionId,
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(req),
  });
  return await resp.json();
}

describe("testTypes tool over HTTP with session", () => {
  it("accepts valid full input", async () => {
    const result = await callTestTypesHTTP({
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
    expect(result.result.json).toMatchObject({
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
    const result = await callTestTypesHTTP({
      fruit: "apple",
      mode: "manual",
      country: "FR",
      zip: "54321",
    });
    expect(result.result.json).toMatchObject({
      fruit: "apple",
      score: 5,
      mode: "manual",
      country: "FR",
      zip: "54321",
      size: "2",
      favoriteColor: "blue",
    });
  });

  it("fails for invalid enum", async () => {
    const result = await callTestTypesHTTP({
      fruit: "invalidfruit",
      mode: "auto",
      country: "US",
      zip: "12345",
    });
    expect(result.error || result.result?.error).toBeTruthy();
  });

  it("fails for invalid zip", async () => {
    const result = await callTestTypesHTTP({
      fruit: "pear",
      mode: "auto",
      country: "US",
      zip: "notazip",
    });
    expect(result.error || result.result?.error).toBeTruthy();
  });
});
