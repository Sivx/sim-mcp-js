# sim-mcp

Minimal, MCP-compliant framework for LLM tools, scripting, and automation.

---

## Install

```sh
npm install sim-mcp
npm install -D typescript tsx
npm install -g @modelcontextprotocol/inspector   # (Optional) For MCP stdio testing
```

---

## Usage

```ts
import { toolsJson, ChatAssistant, isMCP } from "sim-mcp";

/** Input for weather info for a city */
export interface WeatherInput {
  /** Name of the city */
  name: string;
}

/**
 * Get weather info for a city.
 * @param wi Weather input
 * @returns Weather description string
 */
export async function Weather(wi: WeatherInput) {
  return `The weather in ${wi.name} is sunny with 75°F.`;
}

/** Input for greeting */
export interface GreetInput {
  /** Name of the person to greet */
  name: string;
}

/**
 * Return a friendly greeting for a user.
 * @param gi Greeting input
 * @returns Greeting string
 */
export function Greet(gi: GreetInput) {
  return `Hello, ${gi.name}!`;
}

/** No input for random city generation */
export interface RandomCityInput {}

/**
 * Generate a random city name using the LLM.
 * @returns City name string
 */
export async function RandomCity(_: RandomCityInput) {
  const bot = new ChatAssistant();
  const res = await bot.solo("Suggest a random city name.");
  return res.text || "Unknown City";
}

const allTools = toolsJson([Weather, Greet, RandomCity]);
const greetTool = toolsJson([Greet]);

if (!isMCP()) {
  (async () => {
    const bot = new ChatAssistant({
      instructions: "Concise and helpful.",
      tools: allTools,
    });

    // PROMPT: User-driven Q&A loop
    let res;
    do {
      res = await bot.prompt("Ask about weather, greeting, or type 'exit':");
      if (res.text) console.log("Assistant:", res.text);
    } while (res.type !== "exit");

    // CHAINING: Use RandomCity, then Weather
    const city = await bot.decide("Pick a random city.");
    if (city.error || !city.result) {
      console.log("Error getting random city.");
      return;
    }
    const weather = await bot.decide(`What's the weather in ${city.result}?`);
    if (weather.error) {
      console.log("Error getting weather.");
      return;
    }
    console.log(`Random city: ${city.result}\nWeather: ${weather.text}`);

    // DISCUSS: LLM-only chat (no tools)
    const chatRes = await bot.discuss(
      "Tell me something interesting about the world's capitals."
    );
    console.log("Discuss:", chatRes.text);

    // DECIDE with custom tool set: only greet
    const greetRes = await bot.decide("Say hello to Alex.", {
      tools: greetTool,
    });
    console.log("Decide (greet only):", greetRes.text);
  })();
}
```

---

## Assistant Methods

| Method    | Use Case                                    | Tool Calls | User Input | LLM Only | Description                                                      |
| --------- | ------------------------------------------- | ---------- | ---------- | -------- | ---------------------------------------------------------------- |
| `prompt`  | Interactive Q&A / user-driven chat          | Yes        | Yes        | Yes      | User types questions, assistant responds (with or without tools) |
| `decide`  | Force tool call (function-call only)        | Yes        | No         | No       | LLM _must_ use a tool to answer the prompt                       |
| `chat`    | General purpose (tool or text, LLM decides) | Optional   | No         | Yes      | LLM answers freely or calls a tool if it decides to              |
| `solo`    | One-shot, LLM-only response (no tools used) | No         | No         | Yes      | Always a single LLM text reply, no function-calling              |
| `discuss` | Chat/discussion mode (no tools allowed)     | No         | No         | Yes      | Conversation, summaries, or info without tool invocation         |

- All methods accept options such as `{ model, instructions, tools }`.

---

## API

- `toolsJson(tools: Function[])`
- `ChatAssistant({ model?, instructions?, tools? })`
  - `.prompt(message, options?)`
  - `.decide(message, options?)`
  - `.chat(message, options?)`
  - `.solo(message, options?)`
  - `.discuss(message, options?)`
- `isMCP()`

_Default export_: `{ toolsJson, ChatAssistant, isMCP }`

---

## MCP Tool Testing

```sh
npx @modelcontextprotocol/inspector tsx yourfile.ts
```

---

## Environment

- Use `.env` at project root for `OPENAI_API_KEY` and other variables.
- `.env` is auto-loaded.

---

## About

By Dan Whitehead (<whiteheaddanieljames@gmail.com>)  
Zero-config, tool-first automation for LLMs and MCP.

---

## License

MIT
