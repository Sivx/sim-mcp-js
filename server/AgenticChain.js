export class AgenticChain {
  constructor(assistant) {
    this.assistant = assistant;
    this.steps = [];
    this.states = {};
    this.memory = {};
  }
  chat(prompt, options) {
    this.steps.push(async (ctx) => {
      const res = await this.assistant.chat(
        typeof prompt === "function" ? prompt(ctx) : prompt,
        options
      );
      ctx.last = res;
      return res;
    });
    return this;
  }
  solo(prompt, options) {
    this.steps.push(async (ctx) => {
      const res = await this.assistant.solo(
        typeof prompt === "function" ? prompt(ctx) : prompt,
        options
      );
      ctx.last = res;
      return res;
    });
    return this;
  }
  discuss(prompt, options) {
    this.steps.push(async (ctx) => {
      const res = await this.assistant.discuss(
        typeof prompt === "function" ? prompt(ctx) : prompt,
        options
      );
      ctx.last = res;
      return res;
    });
    return this;
  }
  decide(prompt, options) {
    this.steps.push(async (ctx) => {
      const res = await this.assistant.decide(
        typeof prompt === "function" ? prompt(ctx) : prompt,
        options
      );
      ctx.last = res;
      return res;
    });
    return this;
  }
  then(fn) {
    this.steps.push(async (ctx) => {
      const result = await fn(ctx.last, ctx);
      ctx.last = result;
      return result;
    });
    return this;
  }
  set(key, fn) {
    this.steps.push(async (ctx) => {
      const value = typeof fn === "function" ? await fn(ctx.last, ctx) : fn;
      ctx.memory[key] = value;
      return value;
    });
    return this;
  }
  get(key) {
    return this.memory[key];
  }
  tap(fn) {
    this.steps.push(async (ctx) => {
      await fn(ctx.last, ctx);
      return ctx.last;
    });
    return this;
  }
  goto(stateName) {
    this.steps.push(async (ctx) => {
      ctx._goto = stateName;
    });
    return this;
  }
  if(predicate, thenState) {
    this.steps.push(async (ctx) => {
      if (await predicate(ctx)) ctx._goto = thenState;
    });
    return this;
  }
  state(name, fn) {
    this.states[name] = fn;
    return this;
  }

  answer(prompt, options) {
    this.steps.push(async (ctx) => {
      const p = typeof prompt === "function" ? prompt(ctx) : prompt;
      const res = await ctx.assistant.choice(p, { ...options, type: "text" });
      ctx.last = res;
      return res;
    });
    return this;
  }

  choose(prompt, options) {
    this.steps.push(async (ctx) => {
      const p = typeof prompt === "function" ? prompt(ctx) : prompt;
      const res = await ctx.assistant.choice(p, { ...options, type: "choice" });
      ctx.last = res;
      return res;
    });
    return this;
  }

  yesOrNo(prompt, options) {
    this.steps.push(async (ctx) => {
      const p = typeof prompt === "function" ? prompt(ctx) : prompt;
      const res = await ctx.assistant.choice(p, { ...options, type: "yesno" });
      res.choice = res.result.choice;
      ctx.last = res;
      return res;
    });
    return this;
  }

  sleep(ms) {
    this.steps.push(async (ctx) => {
      await new Promise((r) => setTimeout(r, ms));
      return ctx.last;
    });
    return this;
  }

  log(label) {
    this.steps.push(async (ctx) => {
      const tag = typeof label === "function" ? label(ctx) : label;
      console.log(tag ?? "[log]", { last: ctx.last, memory: ctx.memory });
      return ctx.last;
    });
    return this;
  }

  ifDo(predicate, fnTrue, fnFalse) {
    this.steps.push(async (ctx) => {
      const cond =
        typeof predicate === "function" ? await predicate(ctx) : !!predicate;
      if (cond && fnTrue) {
        const r = await fnTrue(ctx.last, ctx);
        ctx.last = r;
        return r;
      }
      if (!cond && fnFalse) {
        const r = await fnFalse(ctx.last, ctx);
        ctx.last = r;
        return r;
      }
      return ctx.last;
    });
    return this;
  }

  whileDo(predicate, build, options = {}) {
    this.steps.push(async (ctx) => {
      const max = options.maxIterations ?? 20;
      let count = 0;
      let out = null;
      while (true) {
        const cond = await predicate(ctx);
        if (!cond) break;
        if (++count > max) throw new Error("whileDo: maxIterations exceeded");
        const sub = ctx.assistant.chain();
        sub.memory = ctx.memory;
        const built = (await build(sub, ctx, count - 1)) || sub;
        out = await built.run(null);
      }
      ctx.last = out;
      return out;
    });
    return this;
  }

  repeat(times, build) {
    this.steps.push(async (ctx) => {
      let out = null;
      const n = Math.max(0, times | 0);
      for (let i = 0; i < n; i++) {
        const sub = ctx.assistant.chain();
        sub.memory = ctx.memory;
        const built = (await build(sub, ctx, i)) || sub;
        out = await built.run(null);
      }
      ctx.last = out;
      return out;
    });
    return this;
  }

  default(key, valueOrFn) {
    this.steps.push(async (ctx) => {
      if (ctx.get(key) == null) {
        const v =
          typeof valueOrFn === "function"
            ? await valueOrFn(ctx.get(key), ctx)
            : valueOrFn;
        ctx.set(key, v);
        ctx.last = v;
        return v;
      }
      return ctx.last;
    });
    return this;
  }

  branch(predicate, buildTrue, buildFalse) {
    this.steps.push(async (ctx) => {
      const cond =
        typeof predicate === "function" ? await predicate(ctx) : !!predicate;
      const builder = cond ? buildTrue : buildFalse;
      if (!builder) return ctx.last;
      const sub = ctx.assistant.chain();
      sub.memory = ctx.memory; // share memory
      const built = (await builder(sub, ctx)) || sub; // builder returns the chain
      const out = await built.run(null);
      ctx.last = out;
      return out;
    });
    return this;
  }

  async run(startState, options = {}) {
    const ctx = {
      memory: this.memory,
      last: null,
      get: (k) => this.memory[k],
      set: (k, v) => (this.memory[k] = v),
      assistant: this.assistant,
      _goto: null,
      _next: null, // { target, after?, visitedOnly?, when?, once? }
      _visited: new Set(), // track visited states
      _current: null, // name of the state currently executing
      goto: (stateName) => {
        ctx._goto = stateName;
        return stateName;
      },
      next: (stateName, opts = {}) => {
        ctx._next = { target: stateName, ...opts };
        return stateName;
      },
      hasGoto: () => ctx._goto !== null && ctx._goto !== undefined,
      clearGoto: () => {
        ctx._goto = null;
      },
    };
    // Pre-state steps
    for (const step of this.steps) await step(ctx);

    let state = ctx._goto || startState;
    ctx._goto = null;
    const maxSteps = options.max_steps ?? 100; // default 100
    let stepCount = 0;

    while (state) {
      if (++stepCount > maxSteps) throw new Error("Max state steps exceeded.");

      const fn = this.states[state];
      if (!fn) throw new Error(`State '${state}' not found`);

      ctx._current = state;
      ctx._visited.add(state);

      const ret = await fn(ctx);
      let nextState = ret;

      // Hard jump always wins
      if (ctx._goto !== null && ctx._goto !== undefined) {
        nextState = ctx._goto;
        ctx._goto = null;
        ctx._next = null; // optional: clear queued-next on hard jump
      } else if (ctx._next) {
        const n = ctx._next;
        const afterOk = !n.after
          ? true
          : Array.isArray(n.after)
          ? n.after.includes(ctx._current)
          : n.after === ctx._current;
        const visitedOk = n.visitedOnly ? ctx._visited.has(n.target) : true;

        const whenOk = typeof n.when === "function" ? await n.when(ctx) : true;

        if (afterOk && visitedOk && whenOk) {
          nextState = n.target;
        }

        if (n.once !== false) ctx._next = null; // default: consume once
      }

      state = nextState;
    }

    // Old
    return ctx.last;
  }
}
