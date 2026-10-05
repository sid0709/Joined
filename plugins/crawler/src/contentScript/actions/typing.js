import { randomBetween, setNativeValue, supportsSelectionRange, wait } from "./dom";

/**
 * Types a string into an input element character by character to simulate smooth typing.
 * Uses a combination of value insertion and event dispatching to be compatible with modern frameworks.
 * @param {HTMLElement} element The input or textarea element.
 * @param {string} text The string to type.
 */
export async function typeSmoothly(element, text, options = {}) {
  if (!element) return;
  const stringText = text == null ? "" : String(text);

  const minDelayMs = Number.isFinite(options.minDelayMs) ? options.minDelayMs : 10;
  const maxDelayMs = Number.isFinite(options.maxDelayMs) ? options.maxDelayMs : 40;

  if (element && element.focus) element.focus();
  setNativeValue(element, "");
  element.dispatchEvent(new Event("input", { bubbles: true }));

  for (const char of stringText) {
    const nextValue = `${element.value ?? ""}${char}`;
    setNativeValue(element, nextValue);

    if (supportsSelectionRange(element)) {
      const length = nextValue.length;
      try {
        element.setSelectionRange(length, length);
      } catch {
        // Ignore browser quirks for specific input types.
      }
    }

    element.scrollLeft = element.scrollWidth;
    if (element instanceof HTMLTextAreaElement) {
      element.scrollTop = element.scrollHeight;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(randomBetween(minDelayMs, maxDelayMs));
  }

  element.dispatchEvent(new Event("change", { bubbles: true }));
}
