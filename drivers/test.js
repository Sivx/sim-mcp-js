import dotenv from "dotenv";
dotenv.config();

import { OpenAI } from "openai";

const openai = new OpenAI();

const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get current temperature for provided coordinates in celsius.",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
        required: ["latitude", "longitude"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

const messages = [
  {
    role: "user",
    content: "What's the weather like in Paris today?",
  },
];

let request = {
  model: "gpt-4.1-mini",
  messages,
  tools,
  store: true,
};

const completion = await openai.chat.completions.create(request);
console.log(JSON.stringify(request, null, 2));
const toolCall = completion.choices[0].message.tool_calls[0];
const args = JSON.parse(toolCall.function.arguments);
console.log("Tool call:", toolCall);
console.log("Tool call arguments:", args);
