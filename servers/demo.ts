import { ad } from "vitest/dist/chunks/reporters.d.BFLkQcL6.js";
import { ChatAssistant, isCli, isMCP } from "../sim-mcp.js";

import { weather } from "./weather.ts";

import { updatedWeather } from "./weather2.ts";

import { ParallelWebSearch } from "./search.ts";

export interface WeatherInput {
  /** Retrieves current weather for the given location. */
  city: string;
}

export function weatheradvanced(wi: WeatherInput) {
  const { city } = wi;
  if (!city) {
    throw new Error("The 'city' field is required.");
  }
  return `The weather in ${city} is sunny with 105°F.`;
}

if (isCli()) {
  (async () => {
    const bot = new ChatAssistant();
    /*
    const r1 = await bot.choice("Is this true? I have 2 fingers", {
      kind: "yesno",
    }); // r1.result.choice -> boolean
    console.log("r1:", r1);
    */
    let test = await bot
      .chain()
      .addTools([ParallelWebSearch])
      .decide(
        "Whats the weather in Virginia Beach? Search the weather with the tools if needed."
      )
      .chat("Whats the weather in Virginia Beach?")
      .run();
    console.log("Done");
  })();
}
