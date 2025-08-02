import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function stdioFlow(server) {
  const transport = new StdioServerTransport();
  transport.onclose = () => {
    console.log("Stdio transport closed");
  };
  server.connect(transport);
}
