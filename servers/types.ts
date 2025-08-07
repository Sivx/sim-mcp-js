import { toolsJson, ChatAssistant, isMCP } from "../sim-mcp.js";

/** Greeting input */
export interface WeatherInput {
  /** Retrieves current weather for the given location. */
  location: string;
}

/** Get current temperature for provided city in celsius */
export function Weather(wi: WeatherInput) {
  if (!wi.location) {
    throw new Error("The 'location' field is required.");
  }
  return `The weather in ${wi.location} is sunny with 75°F.`;
}

const tools: any[] = toolsJson([Weather]);

if (!isMCP()) {
  (async () => {
    const bot = new ChatAssistant({ tools });

    let final = await bot
      .chain()
      .chat("What is your name?")
      .set("userName", (res) => res.text)
      .state("start", async (ctx) => {
        console.log("Starting chain...");
        const name = ctx.get("userName");
        const res = await ctx.assistant.chat(
          `Hello ${name}, what is your favorite color?`
        );
        ctx.set("color", res.text);
        return "end";
      })
      .state("end", async (ctx) => {
        console.log("Ending chain...");
        const name = ctx.get("userName");
        const color = ctx.get("color");
        let tmp = await ctx.assistant.chat(
          `${name}, your favorite color is ${color}.`
        );
        console.log(tmp.text);
        return null;
      })
      .run("start", { max_steps: 10 })
      .catch((err) => {
        if (err.message.includes("Max state steps exceeded")) {
          // Handle the loop limit gracefully
          console.log("State machine stopped: too many steps.");
        } else {
          // Other errors
          console.error(err);
        }
      });
  })();
}
