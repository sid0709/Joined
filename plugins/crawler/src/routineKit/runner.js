import { describeSelector, describeStep, fieldLabel } from "./describe.js";
import { listFields } from "./routine.js";
import { ON_MISSING } from "./steps.js";
import { STRATEGY_PHASES } from "./strategies.js";

/**
 * Runs one pass of a routine. The runner never touches the DOM: every page action is an
 * op sent through `hooks.exec({ op, ...payload })`, which the side panel routes to the
 * content script (see contentScript/messages/routineOps.js). Ops: count, highlight,
 * clear, click, extract.
 *
 * Hooks:
 * - `exec(op)` → Promise of the op's result. Required.
 * - `signal`: an AbortSignal; aborting stops the pass with RoutineStoppedError.
 * - `opTimeoutMs`: overrides OP_TIMEOUT_MS.
 * - `onProgress(percent)`, `onNotice(message, ok)`: ok is false when a wait timed out.
 * - `onActivity({ phase, label, kind?, field? })` before each step (with its kind), each
 *   field (with its path), and the record hand-off.
 *   Phases: the strategy's phase names, plus "read" (fields) and "submit" (onRecord).
 * - `onField(path, value, record, found)` after each field is read.
 * - `onRecord(record)` with the finished record. Throw to reject it.
 */

/** How long an op may run beyond its own wait before the page counts as unresponsive. */
export const OP_TIMEOUT_MS = 10_000;

export class RoutineStoppedError extends Error {
  constructor() {
    super("Routine stopped");
    this.name = "RoutineStoppedError";
  }
}

/** The run is over: the routine found nothing left to process. */
export class RoutineFinishedError extends Error {
  constructor(message) {
    super(message);
    this.name = "RoutineFinishedError";
  }
}

export class RoutineStepError extends Error {
  constructor(message) {
    super(message);
    this.name = "RoutineStepError";
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new RoutineStepError(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function createContext(routine, hooks) {
  const checkStopped = () => {
    if (hooks.signal?.aborted) throw new RoutineStoppedError();
  };
  const opTimeoutMs = hooks.opTimeoutMs ?? OP_TIMEOUT_MS;
  const call = async (op, payload = {}, waitMs = 0) => {
    checkStopped();
    const result = await withTimeout(
      Promise.resolve(hooks.exec({ op, ...payload })),
      waitMs + opTimeoutMs,
      `Page op "${op}"`,
    );
    checkStopped();
    return result ?? {};
  };
  const rest = async (ms) => {
    if (ms > 0) await sleep(ms);
    checkStopped();
  };
  return { routine, hooks, call, rest, checkStopped };
}

function handleMissing(step) {
  const target = describeSelector(step.selector);
  if (step.onMissing === ON_MISSING.SKIP) return;
  if (step.onMissing === ON_MISSING.FINISH) {
    throw new RoutineFinishedError(`Nothing left to process (no match for ${target})`);
  }
  throw new RoutineStepError(`No element matches ${target}`);
}

/** Poll the match count until `isDone(count)` or the step's timeout. True when done. */
async function pollCount(ctx, step, isDone) {
  const deadline = Date.now() + step.timeout;
  for (;;) {
    const { count = 0 } = await ctx.call("count", { selector: step.selector });
    if (isDone(count)) return true;
    if (Date.now() >= deadline) return false;
    await ctx.rest(step.interval);
  }
}

const STEP_RUNNERS = {
  highlight: (ctx, step) => ctx.call("highlight", { selector: step.selector }),
  clear: (ctx) => ctx.call("clear"),
  pause: (ctx, step) => ctx.rest(step.ms),
  click: async (ctx, step) => {
    if (step.highlight) await ctx.call("highlight", { selector: step.selector });
    const { found } = await ctx.call(
      "click",
      { selector: step.selector, nth: step.nth, wait: step.wait },
      step.wait,
    );
    if (!found) handleMissing(step);
  },
  waitFor: async (ctx, step) => {
    if (!(await pollCount(ctx, step, (count) => count > 0))) handleMissing(step);
  },
  waitGone: async (ctx, step) => {
    const gone = await pollCount(ctx, step, (count) => count === 0);
    if (step.notice) ctx.hooks.onNotice?.(`${step.notice}: ${gone ? "done" : "timed out"}`, gone);
  },
};

async function runSteps(ctx, steps, progress, phase) {
  for (const step of steps) {
    ctx.hooks.onActivity?.({ phase, label: describeStep(step), kind: step.kind });
    await STEP_RUNNERS[step.kind](ctx, step);
    progress.tick();
  }
}

function setPath(record, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let target = record;
  for (const key of keys) {
    if (!target[key] || typeof target[key] !== "object") target[key] = {};
    target = target[key];
  }
  target[last] = value;
}

async function readFields(ctx, progress) {
  const { highlightFields, fieldPauseMs } = ctx.routine.options;
  const record = {};
  for (const { path, field } of listFields(ctx.routine)) {
    ctx.hooks.onActivity?.({
      phase: "read",
      label: `Reading ${fieldLabel(path, field).toLowerCase()}`,
      field: path,
    });
    if (highlightFields) await ctx.call("highlight", { selector: field.selector });
    const { found = false, value } = await ctx.call("extract", { field }, field.wait);
    setPath(record, path, value);
    ctx.hooks.onField?.(path, value, record, found);
    if (highlightFields) await ctx.call("clear");
    await ctx.rest(fieldPauseMs);
    progress.tick();
  }
  return record;
}

async function runListDetailPass(ctx, progress) {
  const { open, ready, dismiss, settle } = ctx.routine.strategy;
  await runSteps(ctx, open, progress, "open");
  await runSteps(ctx, ready, progress, "ready");

  let rejection = null;
  try {
    const record = await readFields(ctx, progress);
    ctx.hooks.onActivity?.({ phase: "submit", label: "Saving record" });
    await ctx.hooks.onRecord?.(record);
  } catch (error) {
    if (error instanceof RoutineStoppedError) throw error;
    rejection = error;
  }
  progress.tick();

  // Dismiss even a rejected record, or the next pass would open the same item again.
  await runSteps(ctx, dismiss, progress, "dismiss");
  if (rejection) throw rejection;
  await runSteps(ctx, settle, progress, "settle");
}

const STRATEGY_RUNNERS = {
  listDetail: runListDetailPass,
};

function countUnits(routine) {
  const phases = STRATEGY_PHASES[routine.strategy.kind];
  const steps = phases.reduce((total, phase) => total + routine.strategy[phase].length, 0);
  // One unit per step, per field, and one for handing over the record.
  return steps + listFields(routine).length + 1;
}

function createProgress(total, onProgress) {
  let done = 0;
  onProgress?.(0);
  return {
    tick() {
      done += 1;
      onProgress?.(Math.min(100, Math.round((done / total) * 100)));
    },
  };
}

/** Run one pass of `routine`. Resolves when the pass is done; see the errors above. */
export async function runRoutinePass(routine, hooks) {
  const run = STRATEGY_RUNNERS[routine.strategy.kind];
  if (!run) throw new Error(`Unsupported strategy: ${routine.strategy.kind}`);
  if (typeof hooks?.exec !== "function") throw new Error("runRoutinePass needs hooks.exec");
  const ctx = createContext(routine, hooks);
  ctx.checkStopped();
  await run(ctx, createProgress(countUnits(routine), hooks.onProgress));
}
