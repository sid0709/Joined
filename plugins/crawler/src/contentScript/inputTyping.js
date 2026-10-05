export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

const SELECTION_UNSUPPORTED_TYPES = new Set([
  "email",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

export function supportsSelectionRange(element) {
  if (!element || typeof element.setSelectionRange !== "function") return false;
  const type = (element.getAttribute("type") || element.type || "text").toLowerCase();
  // Chrome throws error on setSelectionRange for specific types (like email/number in some versions)
  // We wrap in try-catch in the usage just in case, but filtering helps.
  return !SELECTION_UNSUPPORTED_TYPES.has(type);
}
