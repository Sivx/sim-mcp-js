# sim-mcp

Create, discover, and invoke tools using the MCP protocol with a minimal interface.

---

## What is an “MCP Server”?

An **MCP server** is just a JavaScript file that wraps one or more tools (functions) in a standard interface using the MCP protocol.

It is not a traditional server—it’s more like how you would write a web service or API, but instead of focusing on network endpoints, MCP servers are optimized for LLMs, scripting, and automation. Each file describes callable tools with clear parameters and documentation, making them easy to read, discover, and invoke.

You can think of MCP servers as “function modules” that are:

- Written and organized similarly to web services
- Designed for easy discovery, reading, and calling by both humans and machines (especially LLMs)
- Simple to share: just drop as many MCP server files as you want into a folder. Then run, chat, and invoke their tools easily.

---

## Install

```sh
npm install sim-mcp
```

---

## Usage

### 1. Write Tool Files (MCP Servers)

Each MCP server file just exports tools with parameter docs:

```js
// ./servers/greet.js
import sim_mcp from "sim-mcp";

sim_mcp.start("greet-server@1.0.0", {
  "greet@A friendly greeting": sim_mcp.tool(
    ({ name }) => `Hello, ${name}!`,
    ["name!@Name to greet"]
  ),
});
```

### 2. LLM Chat/Function Calling (sim_mcp.run)

Start an interactive LLM chat that auto-invokes all your tools:

```js
import sim_mcp from "sim-mcp";

// Requires OPENAI_API_KEY to be set in your environment.
await sim_mcp.run("./servers");
```

- This will load all MCP servers in `./servers` and start a chat powered by an LLM.
- Any function calls in the chat will invoke your tool functions.

**Example output:**

```
Tools:  [
  {
    "type": "function",
    "function": {
      "name": "TestAPI",
      "description": "API Responses demo",
      "parameters": {
        "type": "object",
        "properties": {
          "test": {
            "type": "string"
          }
        }
      }
    }
  }
]
Assistant ID: asst_xxxxxxxx
Thread ID: thread_xxxxxxxx
whoami: {
  assistantId: 'asst_xxxxxxxx',
  threadId: 'thread_xxxxxxxx'
}
> Hello
AI: Hello! How can I assist you today?
> Can you invoke my testapi?
Executing tool: TestAPI with args {}
Tool TestAPI called with args: {}
Tool result: {
  type: 'text',
  text: 'Welcome

to the Test API! You sent: nothing'
}
AI (raw): I have invoked your TestAPI. The response is: "Welcome to the Test API! You sent: nothing."

Would you like to try sending some specific data to the TestAPI?
```

**Tip:**  
You can create a `.env` file in your project with your OpenAI API key (used for LLM-powered chat and function calling):

```
# .env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # Your OpenAI API key for LLM chat/function calling
```

This will be automatically loaded when running your project, so you don’t need to set the environment variable manually each time.

### 3. Directly Invoke a Tool

You can invoke any tool directly (no chat) for scripting or testing:

```js
import sim_mcp from "sim-mcp";

const result = await sim_mcp.invokeTool(
  "greet",
  { name: "Dan" },
  "./servers/greet.js"
);
console.log(result);
```

- `invokeTool(toolName, toolArgs = {}, serverPath = "./test_server.js")`

---

## Parameter Specification

Each parameter string uses this format:  
`name!:type=default@description`

- `name!`: Parameter name. `!` means **required**. Omit `!` for optional.
- `type`: Data type (`int`, `number`, `string`, `boolean`, `string[]`, `int[]`, `number[]`, etc).
- `{enums}`: Enum values (if applicable).
- `=default`: Default value (if applicable).
- `@description`: Description for the prompt.

---

## Example: Parameter Types and Options

```js
import sim_mcp from "sim-mcp";
sim_mcp.start("test-server@1.0.0", {
  "testTypes@Type and option demo": sim_mcp.tool(
    ({
      messages,
      fruit,
      age,
      active,
      score,
      items,
      note,
      mode,
      country,
      zip,
      size,
      favoriteColor,
    }) => ({
      messages,
      fruit,
      age,
      active,
      score,
      items,
      note,
      mode,
      country,
      zip,
      size,
      favoriteColor,
    }),
    [
      "messages:json@JSON to send",
      "fruit!{apple,banana,pear}@Pick a fruit",
      "age:int@User age",
      "active:boolean@Is active",
      "score:number=5@A float with default",
      "items:string[]@Array of strings",
      "note@Optional note",
      "mode!{auto,manual}@Enum required",
      "country!@Country required string",
      "zip!:/^d{5}$/@Zip code (5 digits, required, regex)",
      "size:int{1,2,3}=2@Int enum w/default",
      "favoriteColor:{red,green,blue}=blue@Enum w/default, optional",
    ]
  ),
});
```

---

## Parameters Explained

| Parameter     | Type / Options            | Required | Default | Description                          |
| ------------- | ------------------------- | -------- | ------- | ------------------------------------ |
| messages      | json                      | No       |         | Json to send                         |
| fruit         | enum: apple, banana, pear | Yes      |         | Pick a fruit                         |
| age           | int                       | No       |         | User age                             |
| active        | boolean                   | No       |         | Is active                            |
| score         | number                    | No       | 5       | A float with default                 |
| items         | string[]                  | No       |         | Array of strings                     |
| note          | string                    | No       |         | Optional note                        |
| mode          | enum: auto, manual        | Yes      |         | Enum required                        |
| country       | string                    | Yes      |         | Country required string              |
| zip           | string (regex: /^\d{5}$/) | Yes      |         | Zip code (5 digits, required, regex) |
| size          | int: 1, 2, 3              | No       | 2       | Int enum with default                |
| favoriteColor | enum: red, green, blue    | No       | blue    | Enum with default, optional          |

---

## MCP Prompt

Prompts are auto-generated from your tool and parameter definitions.

To print out the full prompt directly, use the `--prompt` flag:

```sh
node ./servers/greet.js --prompt
```

---

## Test

```sh
npx @modelcontextprotocol/inspector node ./servers/greet.js
```

---

## Environment

- `OPENAI_API_KEY` — Required for `sim_mcp.run` chat and LLM-powered tool invocation.
- `MCP_PORT` — Enables HTTP MCP server (Express). If unset, uses stdio.
- `.env` — Project root file. Automatically loaded for OpenAI key and other vars.
- **Per-file `<filename>.env`** — If you invoke a file like `greet.js`, any `greet.env` in the same directory is automatically loaded, so you can use per-tool/server variables.

**Example:**

```ini
# ./servers/greet.env

MY_GREETING_SIGNATURE=DanBot3000
```

---

## API

- `sim_mcp.start(name: string, handlers: object)`  
  Registers tools in the current file.

- `sim_mcp.tool(fn: Function, paramSpec: Array<string>)`  
  Defines a tool function with parameters.

- `sim_mcp.run(dir: string)`  
  Starts an LLM chat that loads all MCP server files in a directory.

- `sim_mcp.invokeTool(toolName, toolArgs = {}, serverPath = "./test_server.js")`  
  Directly invokes a tool in a given MCP server file.

---

## About the Developer

**sim-mcp** is developed and maintained by Dan Whitehead  
<whiteheaddanieljames@gmail.com>

The goal is to create a user-friendly MCP environment where “servers” (just plain JavaScript tool files) are easily read, written, and called by large language models. The focus is on making tool integration seamless and portable—no complicated server setup, just drop files in a folder and get started.  
Progress is steady, with a long-term plan to launch a public MCP server registry for sharing and discovering tools.

It’s early days, but usability and simplicity are top priorities. Feedback and collaboration are always welcome!

---

## License

MIT
