export function setNativeValue(element, value) {
  if (!element) return;
  const proto =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement?.prototype
      : element instanceof HTMLSelectElement
        ? window.HTMLSelectElement?.prototype
        : window.HTMLInputElement?.prototype;

  const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
  const setter = descriptor?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
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
  const type = (element.getAttribute?.("type") || element.type || "text").toLowerCase();
  return !SELECTION_UNSUPPORTED_TYPES.has(type);
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isElementInViewport(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") return false;
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  return (
    rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewportHeight && rect.right <= viewportWidth
  );
}

export function clickLikeHuman(element) {
  if (!element) return;
  // Only scroll when the element isn't already visible, and use 'nearest'
  // rather than 'center' so an on-screen element never gets re-centered.
  try {
    if (!isElementInViewport(element)) {
      element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  } catch {
    /* best effort */
  }
  try {
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  } catch {
    /* best effort */
  }
  try {
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  } catch {
    /* best effort */
  }
  try {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  } catch {
    /* best effort */
  }
  try {
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  } catch {
    /* best effort */
  }
  try {
    element.click?.();
  } catch {
    /* best effort */
  }
}

export function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
