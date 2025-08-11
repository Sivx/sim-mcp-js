const call = (method) => (prompt, options) => async (ctx) => {
  const p = typeof prompt === "function" ? prompt(ctx) : prompt;
  const res = await ctx.assistant[method](p, options);
  ctx.last = res;
  return res;
};

export const chat = call("chat");
export const solo = call("solo");
export const discuss = call("discuss");
export const decide = call("decide");
/*
new AgenticChain(assistant)
  .chat("Hello, how are you?")
  .discuss("Let's brainstorm ideas for a sci-fi story.")
  .decide("Pick the best title", { tools: ["TitleEvaluator"] })
  .solo("Summarize this in one sentence.")
*/
