// Everything a routine module needs to describe a site. See src/routines/ for examples.
export {
  CORE_JOB_FIELDS,
  CORE_JOB_FIELD_KEYS,
  declareJobFields,
  field,
  FIELD_TYPES,
  listDeclaredFields,
} from "./declaredFields.js";
export {
  attrMatch,
  findElements,
  queryAll,
  queryOne,
  rewriteHashedSuffixes,
  valueMatchesPattern,
} from "./extract.js";
export {
  defineRunView,
  fieldGroup,
  hasRunComponent,
  hasRunSetting,
  hasRunStat,
  listFieldGroups,
  listRunComponents,
  listRunSettings,
  listRunStats,
  RUN_COMPONENT,
  RUN_SETTING,
  RUN_STAT,
} from "./runView.js";
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
