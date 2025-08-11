import type * as A from "./operators/assistant.js";
import type * as Ch from "./operators/choice.js";
import type * as F from "./operators/flow.js";
import type * as M from "./operators/memory.js";
import type * as U from "./operators/utils.js";

type Ops<T> = {
  [K in keyof T]: T[K] extends (...a: any) => any
    ? (...a: Parameters<T[K]>) => AgenticChain
    : never;
};

export interface AgenticChain
  extends Ops<typeof A>,
    Ops<typeof Ch>,
    Ops<typeof F>,
    Ops<typeof M>,
    Ops<typeof U> {}
