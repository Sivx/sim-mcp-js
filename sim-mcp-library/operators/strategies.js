// operators/strategies.js
const x = async (ctx, v, ...a) => (typeof v === "function" ? v(ctx, ...a) : v);

export const paoa =
  (fns, { name = "paoa", max = 10 } = {}) =>
  (chain) =>
    chain
      .state(`${name}:plan`, async (ctx) => {
        ctx.set(`${name}.plan`, await x(ctx, fns.plan));
        return `${name}:act`;
      })
      .state(`${name}:act`, async (ctx) => {
        ctx.last = await x(ctx, fns.act, ctx.get(`${name}.plan`));
        return `${name}:observe`;
      })
      .state(`${name}:observe`, async (ctx) => {
        const obs = await x(ctx, fns.observe);
        ctx.set(`${name}.obs`, obs);
        return fns.goal && (await x(ctx, fns.goal, obs))
          ? `${name}:done`
          : `${name}:adapt`;
      })
      .state(`${name}:adapt`, async (ctx) => {
        await x(ctx, fns.adapt, ctx.get(`${name}.obs`));
        const i = (ctx.get(`${name}.i`) || 0) + 1;
        ctx.set(`${name}.i`, i);
        return i >= max ? `${name}:done` : `${name}:plan`;
      })
      .state(`${name}:done`, async (ctx) => {
        ctx.last = ctx.get(`${name}.obs`);
      });

export const paoaOnce =
  (fns, name = "paoa1") =>
  (chain) =>
    chain
      .state(`${name}:plan`, async (ctx) => {
        ctx.set(`${name}.plan`, await x(ctx, fns.plan));
        return `${name}:act`;
      })
      .state(`${name}:act`, async (ctx) => {
        ctx.last = await x(ctx, fns.act, ctx.get(`${name}.plan`));
        return `${name}:observe`;
      })
      .state(`${name}:observe`, async (ctx) => {
        ctx.set(`${name}.obs`, await x(ctx, fns.observe));
        return `${name}:adapt`;
      })
      .state(`${name}:adapt`, async (ctx) => {
        ctx.last = await x(ctx, fns.adapt, ctx.get(`${name}.obs`));
      });

export const reactLoop =
  (fns, { name = "react", max = 8 } = {}) =>
  (chain) =>
    chain
      .state(`${name}:think`, async (ctx) => {
        ctx.last = await x(ctx, fns.think);
        return `${name}:act`;
      })
      .state(`${name}:act`, async (ctx) => {
        ctx.last = await x(ctx, fns.act, ctx.last);
        return `${name}:observe`;
      })
      .state(`${name}:observe`, async (ctx) => {
        ctx.last = await x(ctx, fns.observe, ctx.last);
        const i = (ctx.get(`${name}.i`) || 0) + 1;
        ctx.set(`${name}.i`, i);
        return (fns.done && (await x(ctx, fns.done, ctx.last))) || i >= max
          ? `${name}:done`
          : `${name}:think`;
      })
      .state(`${name}:done`, async (ctx) => ctx.last);

export const reflexion =
  (fns, { name = "refl", rounds = 2 } = {}) =>
  (chain) =>
    chain
      .state(`${name}:draft`, async (ctx) => {
        ctx.set(`${name}.v`, await x(ctx, fns.draft));
        ctx.set(`${name}.i`, 0);
        return `${name}:crit`;
      })
      .state(`${name}:crit`, async (ctx) => {
        ctx.set(`${name}.c`, await x(ctx, fns.crit, ctx.get(`${name}.v`)));
        return `${name}:rev`;
      })
      .state(`${name}:rev`, async (ctx) => {
        const i = (ctx.get(`${name}.i`) || 0) + 1;
        ctx.set(`${name}.i`, i);
        const vNew = await x(ctx, fns.revise, {
          draft: ctx.get(`${name}.v`),
          critique: ctx.get(`${name}.c`),
        });
        ctx.set(`${name}.v`, vNew);
        return (fns.accept && (await x(ctx, fns.accept, vNew))) || i >= rounds
          ? `${name}:done`
          : `${name}:crit`;
      })
      .state(`${name}:done`, async (ctx) => {
        ctx.last = ctx.get(`${name}.v`);
      });

/*
  // usage: code-fix loop (dogfooding)
import { paoa } from "./operators/strategies.js";

await paoa({
  plan:    (ctx) => `Fix failing test: ${ctx.get("issue")}`,
  act:     (ctx, plan) => ctx.assistant.chat(`Plan:\n${plan}\nPropose minimal patch.`),
  observe: (ctx) => ctx.assistant.chat("Run tests and summarize failures."),
  adapt:   (ctx, obs) => ctx.assistant.chat(`Given test results:\n${obs.text}\nRefine patch.`),
  goal:    (ctx, obs) => /0\s+failures/i.test(obs?.text || "")
})(new AgenticChain(assistant)
    .set("issue","Null ref in parseConfig on empty file"))
  .run("paoa:plan");
js
Copy
Edit
// usage: benchmark tuning loop
await paoa({
  plan:    () => "Improve parse speed by 10%",
  act:     (ctx, plan) => ctx.assistant.chat(`${plan}\nDraft optimization patch.`),
  observe: () => ctx.assistant.chat("Run microbench and report delta vs baseline."),
  adapt:   (ctx, obs) => ctx.assistant.chat(`Delta: ${obs.text}\nPropose next tweak.`),
  goal:    (_, obs) => /improvement:\s*(1[0-9]|[2-9][0-9])%+/i.test(obs?.text || "")
})(new AgenticChain(assistant)).run("paoa:plan");
js
Copy
Edit
// usage: data pipeline healing (bounded retries)
await paoa({
  plan:    () => "Ingest → Transform → Validate",
  act:     () => new AgenticChain(assistant)
                  .parallel([c=>c.chat("ingest A"),c=>c.chat("ingest B")],{failFast:false})
                  .chat("transform")
                  .chat("validate")
                  .run(),
  observe: () => new AgenticChain(assistant).chat("Report pipeline status").run(),
  adapt:   (_, obs) => new AgenticChain(assistant).chat(`Fix based on:\n${obs.text}`).run(),
  goal:    (_, obs) => /status:\s*ok/i.test(obs?.text || "")
}, { max: 5 })(new AgenticChain(assistant)).run("paoa:plan");
*/
