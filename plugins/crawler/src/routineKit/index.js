// Everything a routine module needs to describe a site. See src/routines/ for examples.
export { attr, pairs, prop, text } from "./fields.js";
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
