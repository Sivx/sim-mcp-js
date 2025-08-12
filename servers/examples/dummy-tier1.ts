import { ChatAssistant } from "sim-mcp";

export interface WeatherInput {
  /** Retrieves current weather for the given location. */
  city: string;
}

/** MCP Tools description what this is and how to use it. Its a weather tool that provides advanced weather information. */
export async function weatheradvanced(wi: WeatherInput) {
  const { city } = wi;
  if (!city) {
    throw new Error("The 'city' field is required.");
  }
  return await bot
    .chain()
    .solo("Give a random severe weather update for " + city)
    .run();
}

const bot = new ChatAssistant();
