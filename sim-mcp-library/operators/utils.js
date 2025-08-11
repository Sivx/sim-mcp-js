// operators/utils.js
export const then = (fn) => async (ctx) => {
  const r = await fn(ctx.last, ctx);
  ctx.last = r;
  return r;
};

export const tap = (fn) => async (ctx) => {
  await fn(ctx.last, ctx);
  return ctx.last;
};

export const sleep = (ms) => async (ctx) => {
  const v = typeof ms === "function" ? await ms(ctx.last, ctx) : ms;
  await new Promise((r) => setTimeout(r, v));
  return ctx.last;
};

export const log = (label) => async (ctx) => {
  const tag = typeof label === "function" ? await label(ctx.last, ctx) : label;
  console.log(tag ?? "[log]", { last: ctx.last, memory: ctx.memory });
  return ctx.last;
};

export const noop = () => async (ctx) => ctx.last;

export const tryCatch = (fn, onError) => async (ctx) => {
  try {
    const r = await fn(ctx.last, ctx);
    ctx.last = r;
    return r;
  } catch (e) {
    const h =
      onError ||
      ((_, __, err) => {
        throw err;
      });
    const r = await h(ctx.last, ctx, e);
    ctx.last = r;
    return r;
  }
};

export const measure = (fn) => async (ctx) => {
  const t0 = Date.now();
  const r = await fn(ctx.last, ctx);
  const dt = Date.now() - t0;
  ctx.last = r;
  ctx.memory.__last_duration_ms = dt;
  return r;
};
export const print = (label) => async (ctx) => {
  if (label) console.log(label, ctx.last);
  else console.log(ctx.last);
  return ctx.last;
};

/*
new AgenticChain(assistant)
  .then((last) => last + " world") // transform ctx.last
  .tap((last) => console.log("Debug:", last)) // side-effect only
  .sleep(500) // pause 500ms
  .log("After sleep") // log with label
  .noop() // do nothing, keep ctx.last
  .tryCatch(
    () => { throw new Error("fail") },
    () => "recovered"
  )
  .measure((last) => last + " measured") // run + record duration in ctx.memory.__last_duration_ms
*/
