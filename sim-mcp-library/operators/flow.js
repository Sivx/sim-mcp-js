// operators/flow.js
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const val = async (c, p, ...a) => (typeof p === "function" ? p(c, ...a) : p);

// navigation
export const next = (s, o) => async (c) => c.next(s, o);
export const goto = (s) => async (c) => c.goto(s);

// conditionals
export const _if = (p, t, f) => async (c) =>
  (await val(c, p)) ? t && t(c) : f && f(c);
export const switchCase = (sel, map, def) => async (c) => {
  const k = await val(c, sel);
  const fn = map[k] || def;
  if (fn) return fn(c);
};
export const match = (vFn, cases, def) => async (c) => {
  const v = await val(c, vFn);
  for (const [pred, fn] of cases) {
    if (await val(c, pred, v)) return fn(c);
  }
  if (def) return def(c);
};

// loops
export const _while =
  (p, b, o = {}) =>
  async (c) => {
    let i = 0;
    while (await val(c, p)) {
      if (o.max && ++i > o.max) break;
      await b(c);
    }
  };
export const _for = (iter, b) => async (c) => {
  const a = await val(c, iter);
  for (const item of a) await b({ ...c, item });
};
export const _doWhile = (b, p) => async (c) => {
  do {
    await b(c);
  } while (await val(c, p));
};
export const _until = (p, b) => async (c) => {
  while (!(await val(c, p))) await b(c);
};

// timing
export const sleep = (ms) => async () => wait(ms);
export const timeout = (p, ms, l = "timeout") =>
  ms > 0
    ? Promise.race([
        p,
        new Promise((_, r) => setTimeout(() => r(new Error(l)), ms)),
      ])
    : p;
export const withTimeout = (fn, ms, l) => async (c) => timeout(fn(c), ms, l);

// logging
export const log = (l) => async (c) => (c.last = { label: l, value: c.last });

// parallelism
export const parallel =
  (runs, { failFast = false, timeout: ms = 0 } = {}) =>
  async (c) => {
    const xs = runs.map((r) => timeout(r(), ms));
    c.last = failFast ? await Promise.all(xs) : await Promise.allSettled(xs);
  };
export const raceHedge =
  (runs, { timeout: ms = 0 } = {}) =>
  async (c) =>
    (c.last = await timeout(Promise.race(runs.map((r) => r())), ms));
export const all =
  (runs, { timeout: ms = 0 } = {}) =>
  async (c) =>
    (c.last = await timeout(Promise.all(runs.map((r) => r())), ms));
export const allSettled =
  (runs, { timeout: ms = 0 } = {}) =>
  async (c) =>
    (c.last = await timeout(Promise.allSettled(runs.map((r) => r())), ms));
export const any =
  (runs, { timeout: ms = 0 } = {}) =>
  async (c) => {
    const rs = runs.map((r) => r());
    c.last = await timeout(
      Promise.any
        ? Promise.any(rs)
        : (async () => {
            const a = await Promise.allSettled(rs);
            const ok = a.find((x) => x.status === "fulfilled");
            if (ok) return ok.value;
            throw a;
          })(),
      ms
    );
  };

// resilience
export const fallback = (fns) => async (c) => {
  let e;
  for (const f of fns) {
    try {
      return (c.last = await f(c));
    } catch (x) {
      e = x;
    }
  }
  throw e;
};
export const withRetry =
  (fn, { retries = 3, delay = 0, backoff = 1, jitter = 0 } = {}) =>
  async (c) => {
    let e,
      d = delay;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn(c);
      } catch (x) {
        e = x;
        if (i === retries) throw e;
        if (d) await wait(d + Math.floor(Math.random() * jitter));
        d *= Math.max(1, backoff);
      }
    }
  };
export const tryCatch = (t, h) => async (c) => {
  try {
    return await t(c);
  } catch (e) {
    return h && h(c, e);
  }
};
export const onError = (fn, h) => tryCatch(fn, h);
export const suppress = (fn) => tryCatch(fn, () => {});
export const retryUntil =
  (fn, p, { retries = 5, delay = 0 } = {}) =>
  async (c) => {
    for (let i = 0; i < retries; i++) {
      const r = await fn(c);
      if (await val(c, p, r)) return r;
      if (delay) await wait(delay);
    }
  };
export const withFallbackValue = (fn, valFn) => async (c) => {
  try {
    return await fn(c);
  } catch {
    return (c.last = await val(c, valFn));
  }
};

// concurrency
export const semaphore = (n) => {
  let a = n,
    q = [];
  return {
    acquire: () =>
      new Promise((r) => {
        if (a > 0) {
          a--;
          r();
        } else q.push(r);
      }),
    release: () => {
      a++;
      const r = q.shift();
      if (r) {
        a--;
        r();
      }
    },
  };
};
export const bulkhead = (fn, sem) => async (c) => {
  await sem.acquire();
  try {
    return await fn(c);
  } finally {
    sem.release();
  }
};

// circuit breaker
export const breaker = ({
  failures = 5,
  window = 10000,
  timeout = 15000,
} = {}) => {
  let f = [],
    open = 0;
  return {
    allow: () => Date.now() > open,
    record: (ok) => {
      const t = Date.now();
      f = f.filter((x) => t - x < window);
      if (!ok) f.push(t);
      if (f.length >= failures) {
        open = Date.now() + timeout;
        f = [];
      }
    },
  };
};
export const withBreaker = (fn, br) => async (c) => {
  if (!br.allow()) throw new Error("circuit_open");
  try {
    const r = await fn(c);
    br.record(true);
    return r;
  } catch (e) {
    br.record(false);
    throw e;
  }
};

// caching
export const memo =
  (fn, keyFn, store = Symbol.for("cache")) =>
  async (c) => {
    const k = await val(c, keyFn);
    c.memory[store] ??= new Map();
    if (c.memory[store].has(k)) return (c.last = c.memory[store].get(k));
    const r = await fn(c);
    c.memory[store].set(k, r);
    return (c.last = r);
  };

// rate limiting & queues
export const rateLimiter = ({ max, interval }) => {
  let q = [],
    ts = [];
  const tick = async () => {
    while (q.length) {
      const now = Date.now();
      ts = ts.filter((t) => now - t < interval);
      if (ts.length < max) {
        ts.push(now);
        q.shift()();
      } else {
        await wait(interval - (now - ts[0]));
      }
    }
  };
  return {
    acquire: () =>
      new Promise((r) => {
        q.push(r);
        tick();
      }),
  };
};
export const withRate = (fn, rl) => async (c) => {
  await rl.acquire();
  return fn(c);
};
export const queue = (concurrency = 1) => {
  let run = 0,
    p = [];
  const next = () => {
    if (run >= concurrency || !p.length) return;
    run++;
    p.shift()();
  };
  return {
    push: (fn) =>
      new Promise((res, rej) => {
        p.push(async () => {
          try {
            res(await fn());
          } catch (e) {
            rej(e);
          } finally {
            run--;
            next();
          }
        });
        next();
      }),
  };
};
export const withQueue = (fn, q) => async (c) => q.push(() => fn(c));

// throttle/debounce
export const throttle = (fn, ms) => {
  let t = 0,
    p = null;
  return async (c) => {
    const n = Date.now();
    if (n - t < ms) {
      p =
        p ||
        wait(ms - (n - t)).then(() => {
          p = null;
          return fn(c);
        });
      return p;
    }
    t = n;
    return fn(c);
  };
};
export const debounce = (fn, ms) => {
  let h;
  return (c) =>
    new Promise((r) => {
      clearTimeout(h);
      h = setTimeout(() => r(fn(c)), ms);
    });
};

// sequencing/util
export const pipe =
  (...fns) =>
  async (c) => {
    let r;
    for (const f of fns) r = await f(c);
    return r;
  };
export const compose =
  (...fns) =>
  (c) =>
    fns.reduceRight((p, f) => p.then(() => f(c)), Promise.resolve());
export const tee =
  (...fns) =>
  async (c) => {
    await Promise.all(fns.map((f) => f(c)));
    return c.last;
  };
export const seq = (fns) => async (c) => {
  let r;
  for (const f of fns) r = await f(c);
  c.last = r;
};
export const tap = (fn) => async (c) => {
  await fn(c);
};
export const noop = async () => {};

// state helpers
export const set = (k, v) => async (c) => {
  c.memory[k] = await val(c, v);
};
export const setLast = (k) => async (c) => {
  c.memory[k] = c.last;
};
export const get = (k) => async (c) => c.memory[k];
export const clear = (k) => async (c) => {
  if (k) delete c.memory[k];
  else c.memory = {};
};
/*
const chain = new AgenticChain(assistant)

// Navigation
.state("start", c => c.goto("question"))
.state("question", c => c._if(
  ctx => ctx.memory.score > 5,
  c => c.goto("win"),
  c => c.goto("lose")
))
.state("win", c => c.log("You win!"))
.state("lose", c => c.log("You lose!"))

// Loops
.while(
  ctx => ctx.memory.tasks?.length > 0,
  c => c.pop("tasks").chat(ctx => `Processing ${ctx.last}`)
)
._for(
  ctx => [1, 2, 3],
  c => c.chat(ctx => `Number: ${ctx.item}`)
)

// Timing
.sleep(1000)
.withTimeout(c => c.chat("Quick task"), 5000)

// Parallel & Resilience
.parallel([
  () => chain.chat("Task 1"),
  () => chain.chat("Task 2")
], { failFast: true })
.fallback([
  c => c.chat("Primary"),
  c => c.chat("Fallback")
])
.withRetry(c => c.chat("Retry me"), { retries: 3, delay: 500 })

// Circuit breaker & Rate limiting
const br = breaker();
.withBreaker(c => c.chat("Protected call"), br)

const rl = rateLimiter({ max: 5, interval: 1000 })
.withRate(c => c.chat("Limited call"), rl)

// Queue
const q = queue(2)
.withQueue(c => c.chat("Queued call"), q)

// Composition helpers
.pipe(
  c => c.chat("Step 1"),
  c => c.chat("Step 2")
)
.tee(
  c => c.chat("Branch 1"),
  c => c.chat("Branch 2")
)

// State helpers
.set("foo", "bar")
.setLast("lastFoo")
.get("foo")
.clear("foo")
*/
