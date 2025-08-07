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
  async run(startState, options = {}) {
    const ctx = {
      memory: this.memory,
      last: null,
      get: (k) => this.memory[k],
      set: (k, v) => (this.memory[k] = v),
      assistant: this.assistant,
      _goto: null,
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
      state = await fn(ctx);
      if (ctx._goto) {
        state = ctx._goto;
        ctx._goto = null;
      }
    }
    return ctx.last;
  }
}
