import {
  declaredFieldProblems,
  listDeclaredFields,
  listExtractorFields,
} from "./declaredFields.js";
import { isAttrMatch } from "./extract.js";
import { isValidRead } from "./fields.js";
import { defaultRunView, runViewProblems } from "./runView.js";
import { ON_MISSING, STEP_KINDS } from "./steps.js";
import { STRATEGY_PHASES } from "./strategies.js";
import { isKnownTransform } from "./transforms.js";

/** Defaults for `routine.options`. */
export const DEFAULT_ROUTINE_OPTIONS = Object.freeze({
  /** Outline each field's element while it is read. */
  highlightFields: true,
  /** Pause after each field, in ms. */
  fieldPauseMs: 0,
  /** Allow the same-host `fetch` op. Off unless a routine opts in. */
  allowFetch: false,
});

const ON_MISSING_VALUES = Object.values(ON_MISSING);
const STEPS_WITH_SELECTOR = new Set(["highlight", "click", "waitFor", "waitGone"]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isOneSelector = (value) => isNonEmptyString(value) || isAttrMatch(value);
const isSelector = (value) =>
  isOneSelector(value) || (Array.isArray(value) && value.length > 0 && value.every(isOneSelector));
const isWholeNumber = (value) => Number.isInteger(value) && value >= 0;

function pairPartProblems(part, label) {
  if (!Array.isArray(part) || part.length !== 2) return [`${label} must be [selector, read]`];
  const [selector, read] = part;
  const problems = [];
  if (selector !== null && !isNonEmptyString(selector))
    problems.push(`${label} selector must be a string or null`);
  if (!isValidRead(read)) problems.push(`${label} has unknown read "${read}"`);
  return problems;
}

function fieldProblems(field, path) {
  const at = `field "${path}"`;
  if (field?.kind !== "field")
    return [`${at} must be built with text(), attr(), prop() or pairs()`];
  const problems = [];
  if (!isSelector(field.selector)) problems.push(`${at} needs a selector`);
  if (field.read === "pairs") {
    problems.push(...pairPartProblems(field.pair?.key, `${at} pair key`));
    problems.push(...pairPartProblems(field.pair?.value, `${at} pair value`));
  } else if (!isValidRead(field.read)) {
    problems.push(`${at} has unknown read "${field.read}"`);
  }
  const nths = Array.isArray(field.nth) ? field.nth : [field.nth];
  if (!nths.length || !nths.every(isWholeNumber))
    problems.push(`${at} nth must be a whole number or a list of them`);
  if (field.inner !== null && !isSelector(field.inner))
    problems.push(`${at} inner must be a selector`);
  if (field.inner && Array.isArray(field.nth))
    problems.push(`${at} cannot combine inner with a list nth`);
  if (!isWholeNumber(field.innerNth)) problems.push(`${at} innerNth must be a whole number`);
  if (!isWholeNumber(field.wait)) problems.push(`${at} wait must be a whole number of ms`);
  if (field.label !== undefined && !isNonEmptyString(field.label))
    problems.push(`${at} label must be text`);
  for (const spec of field.then ?? []) {
    if (!isKnownTransform(spec))
      problems.push(`${at} uses unknown transform ${JSON.stringify(spec)}`);
  }
  return problems;
}

function stepProblems(step, label) {
  if (!STEP_KINDS.includes(step?.kind)) return [`${label} has unknown kind "${step?.kind}"`];
  const problems = [];
  if (STEPS_WITH_SELECTOR.has(step.kind) && !isSelector(step.selector))
    problems.push(`${label} needs a selector`);
  if (step.onMissing !== undefined && !ON_MISSING_VALUES.includes(step.onMissing))
    problems.push(`${label} has unknown onMissing "${step.onMissing}"`);
  if (step.kind === "pause" && !isWholeNumber(step.ms)) problems.push(`${label} needs ms`);
  if (step.label !== undefined && !isNonEmptyString(step.label))
    problems.push(`${label} label must be text`);
  return problems;
}

function strategyProblems(strategy) {
  const phases = STRATEGY_PHASES[strategy?.kind];
  if (!phases) return [`unknown strategy "${strategy?.kind}"`];
  return phases.flatMap((phase) => {
    const steps = strategy[phase];
    if (!Array.isArray(steps)) return [`strategy ${phase} must be a list of steps`];
    return steps.flatMap((step, index) => stepProblems(step, `${phase} step ${index + 1}`));
  });
}

/** Every problem with a routine, as readable sentences. Empty means the routine is valid. */
export function routineProblems(routine) {
  if (!routine || typeof routine !== "object") return ["routine must be an object"];
  const problems = [];
  if (!isNonEmptyString(routine.id)) problems.push("id is required");
  if (!isNonEmptyString(routine.label)) problems.push("label is required");
  if (!Number.isInteger(routine.version) || routine.version < 1)
    problems.push("version must be a positive whole number");
  if (!isNonEmptyString(routine.output)) problems.push("output is required");
  if (routine.runPass != null && typeof routine.runPass !== "function") {
    problems.push("runPass must be a function");
  }
  if (routine.readRecord != null && typeof routine.readRecord !== "function") {
    problems.push("readRecord must be a function");
  }
  const hosts = routine.match?.hosts;
  if (!Array.isArray(hosts) || !hosts.length || !hosts.every(isNonEmptyString))
    problems.push("match.hosts must list at least one host");
  problems.push(...strategyProblems(routine.strategy));
  const extractorFields = Object.entries(routine.fields ?? {});
  const declared = routine.declaredFields;
  if (!extractorFields.length && !(Array.isArray(declared) && declared.length)) {
    problems.push("declaredFields or fields must define at least one field");
  }
  problems.push(
    ...declaredFieldProblems(declared, {
      requireCore: routine.output === "job" && Array.isArray(declared),
    }),
  );
  const declaredKeys = Array.isArray(declared) ? declared.map((entry) => entry?.key) : [];
  problems.push(...runViewProblems(routine.runView, declaredKeys.filter(Boolean)));
  for (const [path, field] of extractorFields) problems.push(...fieldProblems(field, path));
  return problems;
}

/**
 * Check a routine and fill in its defaults. Throws when the routine is invalid, so a
 * broken routine fails at load time instead of halfway through a run.
 *
 * A routine is plain data:
 * - `id`, `label`, `version`: who it is.
 * - `match.hosts`: the sites it runs on (subdomains included).
 * - `output`: the kind of record it produces, e.g. "job".
 * - `strategy`: how to move through the site (see strategies.js).
 * - `declaredFields`: schema the side panel and ingest use (key, label, type, required).
 * - `fields`: optional CSS extractors. Dotted paths ("company.name") build nested objects.
 * - `readRecord`: optional function that returns a record instead of CSS extraction.
 * - `options`: see DEFAULT_ROUTINE_OPTIONS.
 */
export function defineRoutine(routine) {
  const problems = routineProblems(routine);
  if (problems.length) {
    throw new Error(`Invalid routine "${routine?.id ?? "unknown"}": ${problems.join("; ")}.`);
  }
  return Object.freeze({
    ...routine,
    options: { ...DEFAULT_ROUTINE_OPTIONS, ...routine.options },
    runView: routine.runView ?? defaultRunView(routine),
  });
}

/** CSS extractor fields as `{ path, field }`, in the order they are read. */
export function listFields(routine) {
  return listExtractorFields(routine);
}

export { listDeclaredFields };
