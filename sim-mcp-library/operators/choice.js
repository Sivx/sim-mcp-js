const choiceStep = (type) => (prompt, options) => async (ctx) => {
  const p = typeof prompt === "function" ? prompt(ctx) : prompt;
  const res = await ctx.assistant.choice(p, { ...options, type });
  if (type === "yesno") res.choice = res.result.choice;
  ctx.last = res;
  return res;
};

export const answer = choiceStep("text");
export const choose = choiceStep("choice");
export const yesOrNo = choiceStep("yesno");
/*
const chain = new AgenticChain(assistant)
  .yesOrNo("Do you like pizza?")
  ._if(
    ctx => ctx.last.choice,
    c => c.answer("What toppings do you like?"),
    c => c.answer("What food do you prefer instead?")
  )
  .choose("Pick a drink", { options: ["Water", "Soda", "Juice"] })
  .answer(ctx => `Final order: pizza=${ctx.memory.pizzaChoice}, drink=${ctx.last.result.text}`)
*/
