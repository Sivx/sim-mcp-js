// AgenticChain.js (auto-wire, JS-only IntelliSense)
/**
 * @typedef {import("./operators/assistant.js")} AssistantOps
 * @typedef {import("./operators/choice.js")}    ChoiceOps
 * @typedef {import("./operators/flow.js")}      FlowOps
 * @typedef {import("./operators/memory.js")}    MemoryOps
 * @typedef {import("./operators/utils.js")}     UtilsOps
 * @typedef {AssistantOps & ChoiceOps & FlowOps & MemoryOps & UtilsOps} ChainOps
 */

import * as A from "./operators/assistant.js";
import * as Ch from "./operators/choice.js";
import * as F from "./operators/flow.js";
import * as M from "./operators/memory.js";
import * as U from "./operators/utils.js";
import * as S from "./operators/strategies.js";

const R = new Set([
  "constructor",
  "run",
  "state",
  "chain",
  "_auto",
  "onError",
  "reset",
  "clone",
  "snapshot",
  "restore",
  "result",
]);
const RW = (s, fns = []) => fns.map((fn) => () => s.chain(fn).run());
const AW = (s, mod, kind) =>
  Object.keys(mod).forEach((k) => {
    if (R.has(k) || k in s) return;
    s[k] = (...a) => {
      if (kind === "runs") {
        s.steps.push(async (c) => {
          await mod[k](RW(s, a[0]), a[1])(c);
        });
        return s;
      }
      s.steps.push(mod[k](...a));
      return s;
    };
  });

/** @implements {ChainOps} */
export class AgenticChain {
  /** @param {any} assistant */
  constructor(assistant) {
    this.assistant = assistant;
    this.steps = [];
    this.states = {};
    this.memory = {};
    this._onError = null;
    this._last = null;
    this._auto();
  }
  /** @param {(c:AgenticChain)=>void} [fn] @returns {AgenticChain} */
  chain(fn) {
    const a = this.assistant.fork ? this.assistant.fork() : this.assistant;
    const c = new AgenticChain(a);
    if (fn) fn(c);
    return c;
  }
  /** @param {string} n @param {(ctx:any)=>Promise<any>|any} fn */ state(
    n,
    fn
  ) {
    this.states[n] = fn;
    return this;
  }
  onError(fn) {
    this._onError = fn;
    return this;
  }
  reset() {
    this.steps = [];
    this.states = {};
    this.memory = {};
    this._last = null;
    return this;
  }
  clone() {
    const a = this.assistant.fork ? this.assistant.fork() : this.assistant;
    const c = new AgenticChain(a);
    c.memory = JSON.parse(JSON.stringify(this.memory || {}));
    return c;
  }
  snapshot() {
    return {
      memory: JSON.parse(JSON.stringify(this.memory || {})),
      prev: this.assistant?.prev ?? null,
    };
  }
  restore(s) {
    if (s?.memory) this.memory = JSON.parse(JSON.stringify(s.memory));
    if ("prev" in (s || {})) this.assistant.prev = s.prev;
    return this;
  }
  result() {
    return this._last;
  }

  /** @param {string} [start] @param {{max_steps?:number, default_timeout_ms?:number, signal?:AbortSignal}} [options] */
  async run(start, options = {}) {
    const { max_steps = 100, default_timeout_ms, signal } = options;
    if (signal?.aborted) throw new Error("aborted");
    const guard = (fn) =>
      default_timeout_ms ? (c) => F.withTimeout(fn, default_timeout_ms)(c) : fn;

    const ctx = {
      memory: this.memory,
      last: null,
      get: (k) => this.memory[k],
      set: (k, v) => (this.memory[k] = v),
      assistant: this.assistant,
      _goto: null,
      _next: null,
      _visited: new Set(),
      _current: null,
      goto: (s) => ((ctx._goto = s), s),
      next: (s, o = {}) => ((ctx._next = { target: s, ...o }), s),
      hasGoto: () => ctx._goto != null,
      clearGoto: () => {
        ctx._goto = null;
      },
    };

    try {
      for (const step of this.steps) {
        if (signal?.aborted) throw new Error("aborted");
        await guard(step)(ctx);
      }
      let st = ctx._goto || start || null;
      ctx._goto = null;
      let i = 0;
      while (st) {
        if (signal?.aborted) throw new Error("aborted");
        if (++i > max_steps) throw Error("Max state steps exceeded.");
        const fn = this.states[st];
        if (!fn) throw Error(`State '${st}' not found`);
        ctx._current = st;
        ctx._visited.add(st);
        const ret = await guard(fn)(ctx);
        let nx = ret;
        if (ctx._goto != null) {
          nx = ctx._goto;
          ctx._goto = null;
          ctx._next = null;
        } else if (ctx._next) {
          const n = ctx._next;
          const ok =
            (!n.after ||
              (Array.isArray(n.after)
                ? n.after.includes(ctx._current)
                : n.after === ctx._current)) &&
            (!n.visitedOnly || ctx._visited.has(n.target)) &&
            (typeof n.when === "function" ? await n.when(ctx) : true);
          if (ok) nx = n.target;
          if (n.once !== false) ctx._next = null;
        }
        st = nx || null;
      }
      this._last = ctx.last;
      return ctx.last;
    } catch (e) {
      if (this._onError) return await this._onError(e, ctx);
      throw e;
    }
  }
  _auto() {
    AW(this, A);
    AW(this, Ch);
    AW(this, M);
    AW(this, U);
    AW(this, S); // <- add this

    const runs = [
      "parallel",
      "raceHedge",
      "all",
      "allSettled",
      "any",
      "fallback",
    ];
    AW(
      this,
      Object.fromEntries(Object.entries(F).filter(([k]) => runs.includes(k))),
      "runs"
    );
    AW(
      this,
      Object.fromEntries(Object.entries(F).filter(([k]) => !runs.includes(k)))
    );
  }
  addTools(fns = []) {
    this.assistant.addTools(fns);
    return this;
  }

  removeTools(fns = []) {
    this.assistant.removeTools(fns);
    return this;
  }

  clearTools() {
    this.assistant.clearTools();
    return this;
  }

  tools(fns = []) {
    this._opts.tools = fns;
    return this;
  }
}
/* Basic 
const chain = new AgenticChain(assistant)

// Basic flow
await chain
  .chat("Hello, how are you?")
  .choose("Pick a color", { choices: ["Red", "Blue", "Green"] })
  .log("Choice made")
  .run()

// State machine
await chain
  .state("start", async (ctx) => {
    ctx.set("count", 0)
    return "loop"
  })
  .state("loop", async (ctx) => {
    ctx.set("count", ctx.get("count") + 1)
    console.log("Count:", ctx.get("count"))
    return ctx.get("count") >= 3 ? "end" : "loop"
  })
  .state("end", async () => console.log("Done"))
  .run("start")

// Parallel tasks
await chain
  .parallel([
    () => chain.chain(c => c.chat("Task 1")).run(),
    () => chain.chain(c => c.chat("Task 2")).run(),
  ])
  .run()

// Resilience with fallback
await chain
  .fallback([
    async (ctx) => { throw new Error("Fail") },
    async (ctx) => "Recovered value"
  ])
  .run()

// Push/pop loop
await chain
  .set("tasks", ["A", "B", "C"])
  ._while(ctx => ctx.memory.tasks?.length > 0, c =>
    c.pop("tasks").chat(last => `Processing ${last}`)
  )
  .run()

// Snapshot/restore
const snap = chain.snapshot()
chain.set("user", "Dan").run()
chain.restore(snap)

// Abort
const controller = new AbortController()
setTimeout(() => controller.abort(), 1000)
chain.chat("Long job").sleep(5000).run(undefined, { signal: controller.signal })
  .catch(e => console.log("Aborted:", e.message))
*/
/* Advanced Usage 
import * as F from "./operators/flow.js";

const br = F.breaker({ failures: 2, window: 5000, timeout: 8000 });
const rl = F.rateLimiter({ max: 3, interval: 1000 });
const q  = F.queue(2);

await new AgenticChain(assistant)
  .set("route", "ingest")
  .goto("boot")
  .state("boot", async ctx => { ctx.next("serve", { after: "ingest" }); return "ingest" })
  .state("ingest", async ctx => { ctx.set("tasks", ["A","B","C"]); return "fan" })
  .state("fan", async ctx => {
    await ctx.chain(c => c.parallel([
      x => x.withRate(rl, y => y.chat("pull A")),
      x => x.withBreaker(br, y => y.withRetry(z => z.chat("pull B"), { retries: 2, delay: 200 })),
      x => x.fallback([ y => y.chat("pull C1"), y => y.chat("pull C2") ])
    ], { failFast: false, timeout: 2500 })).run();
    return "serve";
  })
  .state("serve", async ctx => {
    await ctx.chain(c => c.race([
      x => x.withQueue(q, y => y.chat("serve primary")),
      x => x.withTimeout(y => y.chat("serve hedge"), 400)
    ], { timeout: 2000 })).run();
    ctx.next("serve", { when: c => (c.memory.tasks?.length ?? 0) > 0, once: false });
    return "drain";
  })
  .state("drain", async ctx => {
    await ctx.chain(c => c._while(
      c2 => c2.memory.tasks?.length > 0,
      d => d.pop("tasks").chat(v => `do ${v}`)
    )).run();
    return "done";
  })
  .state("done", async ctx => { ctx.last = "ok" })
  .run();

*/

/* Other strategies
Here are newer/better agentic patterns + your-DSL snippets:

ReAct (think↔act interleave). 
HackerNoon

js
Copy
Edit
await new AgenticChain(assistant)
  .chat("Think: plan next tool call")      // thought
  .decide("Use tool X", { tools:[] }) // act
  .chat("Reflect on observation; choose next act")
  .run()
Reflexion (self-critique + retry). 
arXiv
+2
arXiv
+2

js
Copy
Edit
await new AgenticChain(assistant)
  .chat("Answer v1")
  .chat("Critique v1; list fixes")
  .chat("Answer v2 applying fixes")
  .fallback([ c=>c.chat("Answer v2"), c=>c.chat("Return v1") ])
  .run()
Tree/Graph of Thoughts (search over options). 
arXiv
+2
arXiv
+2
AAAI Open Access Journal
ACM Digital Library

js
Copy
Edit
await new AgenticChain(assistant)
  .parallel([ c=>c.chat("Path A"), c=>c.chat("Path B"), c=>c.chat("Path C") ],{failFast:false})
  .chat("Evaluate paths; pick best")
  .run()
Multi-perspective reflection (Mirror-style). 
ACL Anthology

js
Copy
Edit
await new AgenticChain(assistant)
  .parallel([ c=>c.chat("Explain as perf expert"),
              c=>c.chat("Explain as security reviewer"),
              c=>c.chat("Explain as API consumer") ],{failFast:false})
  .chat("Fuse perspectives; produce final plan")
  .run()
Agentic RAG controller (decide what/when to retrieve). 
Medium
TrueFoundry
arXiv

js
Copy
Edit
await new AgenticChain(assistant)
  ._if(ctx=>,
       c=>c.parallel([ x=>x.chat("Query KB"), x=>x.chat("Web search") ],{failFast:false}),
       c=>c.noop())
  .chat("Synthesize with citations")
  .run()
Think→Act→Observe (TAO) loop (transparent control). 
Medium

js
Copy
Edit
await new AgenticChain(assistant)
  .chat("Think: propose next step")
  .decide("Act: call tool or skip",{tools:[]})
  .chat("Observe: summarize result; next?")
  ._if(ctx=>, c=>c.chat("Finalize"), c=>c.goto("repeat"))
  .run()
Algorithm-of-Thoughts style guided search (structured backtracking). 
Lifewire

js
Copy
Edit
await new AgenticChain(assistant)
  .chat("Draft plan with checkpoints")
  .race([ c=>c.chat("Try path 1"),
          c=>c.withTimeout(x=>x.chat("Try path 2"),400) ],{timeout:2000})
  ._if(ctx=>, c=>c.chat("Backtrack to last checkpoint"))
  .run()
Hedged execution for latency/robustness (pairs well with all above). 
HackerNoon

js
Copy
Edit
await new AgenticChain(assistant)
  .race([ c=>c.chat("Primary toolchain"),
          c=>c.withTimeout(x=>x.chat("Backup chain"),500) ],{timeout:2500})
  .run()
  */
