// Everything a routine module needs to describe a site. See src/routines/ for examples.
export {
  CORE_JOB_FIELDS,
  CORE_JOB_FIELD_KEYS,
  declareJobFields,
  field,
  FIELD_TYPES,
  listDeclaredFields,
} from "./declaredFields.js";
export { attr, html, pairs, prop, rawText, text } from "./fields.js";
export { defineRoutine } from "./routine.js";
export {
  click,
  clearHighlights,
  highlight,
  ON_MISSING,
  pause,
  waitFor,
  waitGone,
} from "./steps.js";
export { listDetail } from "./strategies.js";
