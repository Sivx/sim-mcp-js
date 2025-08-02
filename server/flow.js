const envPort = process.env.MCP_PORT;

async function httpFlow(s) {
  const express = (await import("express")).default;
  const { randomUUID } = await import("crypto");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const app = express();
  app.use(express.json());
  const transports = {};
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    let transport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && req.body && req.body.method === "initialize") {
      const newSessionId = randomUUID();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (id) => {
          transports[id] = transport;
          transport.sessionId = id;
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) delete transports[transport.sessionId];
      };
      await s.connect(transport);
      res.setHeader("mcp-session-id", newSessionId);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }
    await transport.handleRequest(req, res, req.body);
  });

  const handleSessionRequest = async (req, res) => {
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);
  app.listen(envPort);
}

export { httpFlow };
