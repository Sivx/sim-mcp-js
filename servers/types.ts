import { toolsJson, ChatAssistant, isMCP } from "../sim-mcp.js";

/** Greeting input */
export interface WeatherInput {
  /** Name of city */
  name: string;
}

export function Weather(wi: WeatherInput) {
  return `The weather in ${wi.name} is sunny with 75°F.`;
}

const tools: any[] = toolsJson([Weather]);

if (!isMCP()) {
  (async () => {
    console.log(JSON.stringify(tools, null, 2));
    const bot = new ChatAssistant({ instructions: "You’re concise.", tools });
    let res: any;
    do {
      res = await bot.prompt(
        "You can ask me about the weather in any city. Type 'exit' to quit."
      );

      console.log(res);
      console.log("Assistant:", res.text);
    } while (res.type !== "exit");
  })();
}
