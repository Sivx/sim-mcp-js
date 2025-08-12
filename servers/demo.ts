import { ChatAssistant, isCli, isMCP } from "../sim-mcp.js";

//import fs
import fs from "fs";

import { ParallelWebSearch } from "./search.ts";

export interface WeatherInput {
  /** Retrieves current weather for the given location. */
  city: string;
}

export async function weatheradvanced(wi: WeatherInput) {
  const { city } = wi;
  if (!city) {
    throw new Error("The 'city' field is required.");
  }
  return await bot
    .chain()
    .solo("Give a random severe weather update for " + city)
    .run();
  //return `The weather in ${city} is sunny with 105°F.`;
}

export async function weatheradvanced2({
  city,
  daysago,
}: {
  /* Does this turn into a city? */
  city: string;
  daysago: number;
}) {
  if (!city) {
    throw new Error("The 'city' field is required.");
  }
  console.log(daysago);
  return await bot
    .chain()
    .solo(
      "Give a random severe weather update for " +
        city +
        " " +
        daysago +
        " days ago"
    )
    .run();
}

const bot = new ChatAssistant();

if (isCli()) {
  (async () => {
    return;
    /*
    const r1 = await bot.choice("Is this true? I have 2 fingers", {
      kind: "yesno",
    }); // r1.result.choice -> boolean
    console.log("r1:", r1);
    */
    return 0;
    let dummyFile = fs.readFileSync("./examples/dummy-tier1.ts", "utf-8");

    await bot
      .chain()
      .state("start", (ctx) => {
        ctx.set("issue", "Null ref in parseConfig on empty file");
        ctx.goto("end");
      })
      .state("end", (ctx) => {
        console.log("Ending state");
        ctx.set("issue", "Null ref in parseConfig on empty file");
      })
      .run("start");
    /*
    let test = await bot
      .chain()
      .addTools([weatheradvanced])
      .decide(
        "Whats the weather in Virginia Beach? Search the weather with the tools if needed. Add random 1-2 days ago."
      )
      .chat("Whats the weather in Virginia Beach?")
      .run();
      */
    console.log("Done");
  })();
}
