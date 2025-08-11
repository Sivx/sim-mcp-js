// operators/memory.js
const resolveValue = async (ctx, x) =>
  typeof x === "function" ? x(ctx.last, ctx) : x;
const getValue = (ctx, key) => (ctx.get ? ctx.get(key) : ctx.memory[key]);
const setValue = (ctx, key, val) =>
  ctx.set ? ctx.set(key, val) : ((ctx.memory[key] = val), val);
const getAtPath = (obj, path) =>
  path.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);
const setAtPath = (obj, path, val) => {
  const ks = path.split(".");
  let a = obj;
  for (let i = 0; i < ks.length - 1; i++) a = a[ks[i]] ?? (a[ks[i]] = {});
  a[ks.at(-1)] = val;
  return val;
};
const deleteAtPath = (obj, path) => {
  const ks = path.split(".");
  let a = obj;
  for (let i = 0; i < ks.length - 1; i++) a = a?.[ks[i]];
  if (a) delete a[ks.at(-1)];
};

export const set = (key, fn) => async (ctx) =>
  (ctx.last = setValue(ctx, key, await resolveValue(ctx, fn)));
export const get = (key, orElse) => async (ctx) =>
  (ctx.last = getValue(ctx, key) ?? (await resolveValue(ctx, orElse)));
export const def = (key, fn) => async (ctx) => {
  if (getValue(ctx, key) == null)
    ctx.last = setValue(ctx, key, await resolveValue(ctx, fn));
  return ctx.last;
};
export const update = (key, fn) => async (ctx) =>
  (ctx.last = setValue(ctx, key, await resolveValue(ctx, fn)));
export const del = (key) => async (ctx) => {
  ctx.set ? ctx.set(key, undefined) : delete ctx.memory[key];
};
export const clear = () => async (ctx) => {
  ctx.memory = {};
};

export const merge = (key, obj) => async (ctx) =>
  (ctx.last = setValue(ctx, key, {
    ...(getValue(ctx, key) || {}),
    ...(await resolveValue(ctx, obj)),
  }));
export const push = (key, val) => async (ctx) => {
  const arr = [...(getValue(ctx, key) || [])];
  arr.push(await resolveValue(ctx, val));
  ctx.last = setValue(ctx, key, arr);
};
export const pop = (key) => async (ctx) => {
  const arr = [...(getValue(ctx, key) || [])];
  ctx.last = arr.pop();
  setValue(ctx, key, arr);
  return ctx.last;
};

export const inc =
  (key, n = 1) =>
  async (ctx) =>
    (ctx.last = setValue(
      ctx,
      key,
      (+getValue(ctx, key) || 0) + +(await resolveValue(ctx, n))
    ));
export const dec =
  (key, n = 1) =>
  async (ctx) =>
    (ctx.last = setValue(
      ctx,
      key,
      (+getValue(ctx, key) || 0) - +(await resolveValue(ctx, n))
    ));
export const toggle = (key) => async (ctx) =>
  (ctx.last = setValue(ctx, key, !getValue(ctx, key)));

export const copy = (from, to) => async (ctx) =>
  (ctx.last = setValue(ctx, to, getValue(ctx, from)));
export const move = (from, to) => async (ctx) => {
  ctx.last = setValue(ctx, to, getValue(ctx, from));
  await del(from)(ctx);
};

export const setPath = (path, fn) => async (ctx) =>
  (ctx.last = setAtPath(ctx.memory, path, await resolveValue(ctx, fn)));
export const getPath = (path, orElse) => async (ctx) =>
  (ctx.last = getAtPath(ctx.memory, path) ?? (await resolveValue(ctx, orElse)));
export const delPath = (path) => async (ctx) => {
  deleteAtPath(ctx.memory, path);
};
/*
new AgenticChain(assistant)
  .set("user", "Dan")
  .get("user")
  .set("count", 0)
  .inc("count")
  .push("tags", "ai")
  .merge("prefs", { theme: "dark" })
  .def("locale", "en")
  .toggle("active")
  .copy("user", "lastUser")
  .move("lastUser", "prevUser")
  .setPath("profile.name", "Dan")
  .getPath("profile.name")
  .del("active")
  .delPath("profile.name")
  .clear()
*/
