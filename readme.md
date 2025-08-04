# sim-mcp

Minimal, MCP-compliant framework for LLM tools, scripting, and automation.

---

## Install

```sh
npm install sim-mcp
npm install -D typescript tsx
npm install -g @modelcontextprotocol/inspector   # (Optional) Test MCP stdio tools
```

---

## Usage

### Example: Tools Composing with the Assistant

```ts
import { toolsJson, ChatAssistant, isMCP } from "sim-mcp";

export interface WeatherInput {
  name: string;
}
export async function Weather(wi: WeatherInput) {
  // Use the assistant from inside your tool
  const bot = new ChatAssistant();
  const fact = await bot.solo(`Give a quick fun fact about ${wi.name}.`);
  return `The weather in ${wi.name} is sunny with 75°F. Fun fact: ${fact.text}`;
}

const tools = toolsJson([Weather]);

if (!isMCP()) {
  (async () => {
    const bot = new ChatAssistant({
      instructions: "Concise weather info.",
      tools,
    });
    let res;
    do {
      res = await bot.prompt("City? ('exit' to quit)");
      if (res.text) console.log("Assistant:", res.text);
    } while (res.type !== "exit");
  })();
}
```

---

### Advanced Flows: decide, discuss, solo

```ts
import { toolsJson, ChatAssistant } from "sim-mcp";

function Calculator({ x, y }: { x: number; y: number }) {
  return `${x} + ${y} = ${x + y}`;
}
const tools = toolsJson([Calculator]);
const bot = new ChatAssistant({
  instructions: "Calculator. Use the tool to solve math.",
  tools,
});

// Require LLM to use a tool
bot.decide("What is 3 + 7?").then((res) => {
  console.log("decide:", res.result);
});

// Let LLM decide to use a tool or not
bot.discuss("Tell me a math fact or calculate 8+2.").then((res) => {
  console.log("discuss:", res.text);
});

// Just chat, no tools
bot.solo("Say hi.").then((res) => {
  console.log("solo:", res.text);
});
```

---

## MCP Tool Testing

Test your tool via MCP stdio:

```sh
npx @modelcontextprotocol/inspector tsx yourfile.ts
```

---

## Environment

- Use `.env` at project root for `OPENAI_API_KEY` and other vars.
- `.env` is auto-loaded.

---

## API

- `toolsJson(tools: Function[])`
- `ChatAssistant({ model?, instructions?, tools? })`
  - `.chat(prompt, opts?)`
  - `.prompt(msg, opts?)`
  - `.decide(prompt, opts?)`
  - `.discuss(prompt, opts?)`
  - `.solo(prompt, opts?)`
- `isMCP()`

_Default export_: `{ toolsJson, ChatAssistant, isMCP }`

---

## About

By Dan Whitehead (<whiteheaddanieljames@gmail.com>)  
Zero-config, tool-first automation for LLMs and MCP.

---

## License

MIT
