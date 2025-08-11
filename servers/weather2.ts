import { ChatAssistant } from "../sim-mcp.js";

export interface WeatherInput {
  /** Retrieves current weather for the given location. */
  city: string;
}
export function updatedWeather(wi: WeatherInput) {
  const { city } = wi;
  if (!city) {
    throw new Error("The 'city' field is required.");
  }
  return `The weather in ${city} is sunny with 25°F.`;
}
