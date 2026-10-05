/**
 * Human-readable descriptions of routine parts, for the side panel and run activity.
 * Pure functions of routine data.
 */

/** Steps that only pace or tidy the page: worth running, not worth showing as activity. */
export const QUIET_STEP_KINDS = new Set(["pause", "clear", "highlight"]);

/** What people call each strategy kind. */
export const STRATEGY_LABELS = Object.freeze({
  listDetail: "List → detail",
});

/** What people call each strategy phase. */
export const PHASE_LABELS = Object.freeze({
  open: "Open",
  ready: "Ready",
  read: "Read",
  submit: "Save",
  dismiss: "Dismiss",
  settle: "Settle",
});

const READ_LABELS = {
  text: "Text",
  textContent: "Raw text",
  html: "HTML",
  pairs: "Key/value pairs",
};

export const describeSelector = (selector) =>
  Array.isArray(selector) ? selector.join(" | ") : String(selector ?? "");

/** "company.name" → "Company name", "applyLink" → "Apply link". */
export function humanizePath(path) {
  const words = String(path)
    .split(".")
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((word) => word.toLowerCase())
    .filter(Boolean);
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const fieldLabel = (path, field) => field?.label || humanizePath(path);

/** "Text", "Attribute alt", "Property href". */
export function describeRead(read) {
  if (READ_LABELS[read]) return READ_LABELS[read];
  const separator = String(read).indexOf(":");
  const kind = read.slice(0, separator);
  const name = read.slice(separator + 1);
  return `${kind === "attr" ? "Attribute" : "Property"} ${name}`;
}

/** The transforms a field applies, by name: "lines", "replace". */
export const describeTransforms = (then = []) =>
  then.map((spec) => (Array.isArray(spec) ? spec[0] : spec));

/** What a step does, in a few words. A step's own `label` wins. */
export function describeStep(step) {
  if (step.label) return step.label;
  const target = describeSelector(step.selector);
  switch (step.kind) {
    case "click":
      return `Click ${target}`;
    case "highlight":
      return `Highlight ${target}`;
    case "clear":
      return "Clear highlights";
    case "pause":
      return `Pause ${step.ms} ms`;
    case "waitFor":
      return `Wait for ${target}`;
    case "waitGone":
      return `Wait for ${target} to go away`;
    default:
      return step.kind;
  }
}
