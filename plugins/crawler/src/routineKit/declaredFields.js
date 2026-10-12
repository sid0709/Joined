import { fieldLabel } from "./describe.js";
import { isFound, valueAt } from "./html.js";

/** Types a routine may declare for a field. */
export const FIELD_TYPES = Object.freeze({
  STRING: "string",
  URL: "url",
  NUMBER: "number",
  LIST: "list",
  OBJECT: "object",
  DATE: "date",
});

const FIELD_TYPE_VALUES = new Set(Object.values(FIELD_TYPES));

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * One declared field. `required` is false unless set. Core job fields are always required.
 */
export function field(key, label, type, required = false) {
  return { key, label, type, required: Boolean(required) };
}

/** Every job routine must declare these, and they are always required. */
export const CORE_JOB_FIELD_KEYS = Object.freeze([
  "applyUrl",
  "title",
  "description",
  "companyName",
]);

export const CORE_JOB_FIELDS = Object.freeze([
  Object.freeze(field("applyUrl", "Apply URL", FIELD_TYPES.URL, true)),
  Object.freeze(field("title", "Title", FIELD_TYPES.STRING, true)),
  Object.freeze(field("description", "Description", FIELD_TYPES.STRING, true)),
  Object.freeze(field("companyName", "Company", FIELD_TYPES.STRING, true)),
]);

const CORE_KEY_SET = new Set(CORE_JOB_FIELD_KEYS);

export function isCoreJobFieldKey(key) {
  return CORE_KEY_SET.has(key);
}

function normalizeDeclaredField(entry, index) {
  if (!entry || typeof entry !== "object") {
    return { field: null, problems: [`declared field ${index + 1} must be an object`] };
  }
  const problems = [];
  const key = typeof entry.key === "string" ? entry.key.trim() : "";
  const label = typeof entry.label === "string" ? entry.label.trim() : "";
  const type = entry.type;
  if (!isNonEmptyString(key)) problems.push(`declared field ${index + 1} needs a key`);
  if (!isNonEmptyString(label)) problems.push(`declared field "${key || index + 1}" needs a label`);
  if (!FIELD_TYPE_VALUES.has(type)) {
    problems.push(`declared field "${key || index + 1}" has unknown type "${type}"`);
  }
  if (entry.required !== undefined && typeof entry.required !== "boolean") {
    problems.push(`declared field "${key || index + 1}" required must be a boolean`);
  }
  const required = CORE_KEY_SET.has(key) ? true : Boolean(entry.required);
  return {
    field: problems.length ? null : Object.freeze({ key, label, type, required }),
    problems,
  };
}

/**
 * Validate extra fields and prepend the required core when a key is missing.
 * Core keys that the routine lists stay required.
 */
export function declareJobFields(extra = []) {
  if (!Array.isArray(extra)) {
    throw new Error("declareJobFields needs a list of fields");
  }
  const seen = new Set();
  const extras = [];
  const problems = [];
  extra.forEach((entry, index) => {
    const { field: next, problems: nextProblems } = normalizeDeclaredField(entry, index);
    problems.push(...nextProblems);
    if (!next) return;
    if (seen.has(next.key)) {
      problems.push(`declared field "${next.key}" is duplicated`);
      return;
    }
    seen.add(next.key);
    extras.push(next);
  });
  if (problems.length) {
    throw new Error(`Invalid declared fields: ${problems.join("; ")}.`);
  }
  const core = CORE_JOB_FIELDS.filter((item) => !seen.has(item.key));
  return Object.freeze([...core, ...extras]);
}

export function declaredFieldProblems(fields, { requireCore = false } = {}) {
  if (fields == null) return [];
  if (!Array.isArray(fields)) return ["declaredFields must be a list"];
  if (!fields.length) return ["declaredFields must define at least one field"];
  const problems = [];
  const seen = new Set();
  fields.forEach((entry, index) => {
    if (CORE_KEY_SET.has(entry?.key) && entry?.required === false) {
      problems.push(`declared field "${entry.key}" must be required`);
    }
    const { field: next, problems: nextProblems } = normalizeDeclaredField(entry, index);
    problems.push(...nextProblems);
    if (!next) return;
    if (seen.has(next.key)) problems.push(`declared field "${next.key}" is duplicated`);
    seen.add(next.key);
  });
  if (requireCore) {
    for (const key of CORE_JOB_FIELD_KEYS) {
      if (!seen.has(key)) problems.push(`declaredFields must include required core field "${key}"`);
    }
  }
  return problems;
}

/** CSS extractor fields, in read order. Empty when the routine only declares a schema. */
export function listExtractorFields(routine) {
  return Object.entries(routine?.fields ?? {}).map(([path, fieldDef]) => ({
    path,
    field: fieldDef,
  }));
}

/**
 * The fields the side panel shows. Declared schema wins; otherwise CSS field paths.
 */
export function listDeclaredFields(routine) {
  if (Array.isArray(routine?.declaredFields) && routine.declaredFields.length) {
    return routine.declaredFields;
  }
  return listExtractorFields(routine).map(({ path, field: fieldDef }) =>
    Object.freeze({
      key: path,
      label: fieldLabel(path, fieldDef),
      type: FIELD_TYPES.STRING,
      required: false,
    }),
  );
}

/** Tell the side panel about each declared field on a finished record. */
export async function reportDeclaredFields(ctx, progress, record) {
  const { fieldPauseMs } = ctx.routine.options;
  for (const declared of listDeclaredFields(ctx.routine)) {
    ctx.hooks.onActivity?.({
      phase: "read",
      label: `Reading ${declared.label.toLowerCase()}`,
      field: declared.key,
    });
    const value = valueAt(record, declared.key);
    ctx.hooks.onField?.(declared.key, value, record, isFound(value));
    progress?.tick?.();
    if (fieldPauseMs) await ctx.rest(fieldPauseMs);
  }
}
