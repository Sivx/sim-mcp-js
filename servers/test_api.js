/* sim-mcp
TestAPI(test?: optional) -> text
@API Responses demo
- test: Test Var
*/
import sim_mcp from "../sim-mcp.js";

sim_mcp.start("test-server@1.0.0", {
  "TestAPI@API Responses demo": sim_mcp.tool(
    (params) => {
      let { test, _memory = {} } = params;

      //also return process.env.nothing
      if (!_memory.update_memory) {
        _memory.update_memory = "abc";
      } else {
        _memory.update_memory = "def";
      }
      return (
        "Welcome to the Test API! You sent: " +
        (test || "nothing") +
        "." +
        (JSON.stringify(process.env) || "") +
        " Memory: " +
        JSON.stringify(_memory, null, 2) +
        " Params: " +
        JSON.stringify(params, null, 2)
      );
    },
    ["test@Test Var"]
  ),
});
/* mcp v2 json
[
  {
    "name": "TestAPI",
    "description": "API Responses demo",
    "inputSchema": {
      "type": "object",
      "properties": {
        "test": {
          "type": "string"
        }
      }
    }
  }
]
*/
//mcp-marker:dd8d4ce93fd71bfb7156a77810fc8ec0459784ba
