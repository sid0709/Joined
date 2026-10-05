import { findElements } from "./elementFinder";
import { disableAutolancerInputEffects } from "./inputEffects";

const STYLE_ID = "autolancer-tracker-highlight-styles";
let highlightCounter = 1;
let highlightLabels = [];

function ensureHighlightStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
[data-highlighter-outline="true"] {
	outline: 2px solid var(--autolancer-highlight-color, red) !important;
	outline-offset: 2px !important;
	box-shadow: 0 0 0 2px var(--autolancer-highlight-color, red) !important;
}
`;
  (document.head || document.documentElement || document.body).appendChild(style);
}

export function clearHighlights() {
  document.querySelectorAll("[data-autolancer-highlight]").forEach((element) => {
    const variant = element.getAttribute("data-autolancer-highlight");
    element.classList.remove("autolancer-highlight-base");
    if (variant) {
      element.classList.remove(`autolancer-highlight-${variant}`);
    }
    if (element.hasAttribute("data-autolancer-original-position")) {
      element.style.position = element.getAttribute("data-autolancer-original-position") || "";
    }
    element.style.removeProperty("--autolancer-border-radius");
    element.removeAttribute("data-autolancer-original-position");
    element.removeAttribute("data-autolancer-highlight");
  });
  disableAutolancerInputEffects();

  highlightLabels.forEach((label) => label.remove());
  highlightLabels = [];
  document.querySelectorAll("[data-highlighter-outline]").forEach((el) => {
    el.style.removeProperty("outline");
    el.style.removeProperty("outline-offset");
    el.style.removeProperty("box-shadow");
    el.style.removeProperty("--autolancer-highlight-color");
    const originalOutline = el.getAttribute("data-highlighter-original-outline");
    const originalOutlineOffset = el.getAttribute("data-highlighter-original-outline-offset");
    const originalBoxShadow = el.getAttribute("data-highlighter-original-box-shadow");
    if (originalOutline) el.style.outline = originalOutline;
    if (originalOutlineOffset) el.style.outlineOffset = originalOutlineOffset;
    if (originalBoxShadow) el.style.boxShadow = originalBoxShadow;
    el.removeAttribute("data-highlighter-outline");
    el.removeAttribute("data-highlighter-original-outline");
    el.removeAttribute("data-highlighter-original-outline-offset");
    el.removeAttribute("data-highlighter-original-box-shadow");
    el.removeAttribute("data-highlighter-id");
  });
  document.querySelectorAll("[data-highlighter-parent]").forEach((element) => {
    element.removeAttribute("data-highlighter-parent");
    element.style.outline = "";
    element.style.outlineOffset = "";
  });
  highlightCounter = 1;
}

/**
 * Applies a colored outline and a label to a single DOM element.
 * @param {HTMLElement} element The element to highlight.
 * @param {string} color The color of the outline (e.g., 'red', 'blue').
 */
export function applyHighlight(element, color) {
  if (element.hasAttribute("data-highlighter-outline")) return;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  ensureHighlightStyles();

  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;
  const originalBoxShadow = element.style.boxShadow;
  element.setAttribute("data-highlighter-original-outline", originalOutline || "");
  element.setAttribute("data-highlighter-original-outline-offset", originalOutlineOffset || "");
  element.setAttribute("data-highlighter-original-box-shadow", originalBoxShadow || "");
  element.setAttribute("data-highlighter-id", String(highlightCounter));
  element.style.setProperty("--autolancer-highlight-color", color || "red");
  // Inline !important as a second line of defense against page resets that strip classes.
  element.style.setProperty("outline", `2px solid ${color || "red"}`, "important");
  element.style.setProperty("outline-offset", "2px", "important");
  element.style.setProperty("box-shadow", `0 0 0 2px ${color || "red"}`, "important");
  element.setAttribute("data-highlighter-outline", "true");
  addLabel(element, highlightCounter);
  highlightCounter++;
}

/**
 * A helper function that finds and highlights elements matching a pattern.
 * @param {string} componentType The tag name (e.g., 'div').
 * @param {string} propertyName The attribute to search against.
 * @param {string} pattern The pattern for the property's value.
 * @param {string} color The highlight color.
 * @returns {{ matched: number, highlighted: number }}
 */
export function highlightByPattern(componentType, propertyName, pattern, color) {
  const result = highlightElements(findElements(componentType, propertyName, pattern), color);
  console.log(`Found ${result.matched} elements, highlighted ${result.highlighted}.`);
  return result;
}

/**
 * Outline each element.
 * @param {Iterable<HTMLElement>} elements The elements to highlight.
 * @param {string} color The highlight color.
 * @returns {{ matched: number, highlighted: number }}
 */
export function highlightElements(elements, color) {
  let matched = 0;
  let highlighted = 0;
  for (const el of elements) {
    matched += 1;
    const before = el.hasAttribute("data-highlighter-outline");
    applyHighlight(el, color);
    if (!before && el.hasAttribute("data-highlighter-outline")) highlighted += 1;
  }
  return { matched, highlighted };
}

function addLabel(el, id) {
  const rect = el.getBoundingClientRect();
  const label = document.createElement("div");
  label.textContent = id;
  label.style.position = "fixed";
  // For fixed positioning, use viewport coordinates directly (no scroll offsets)
  const top = Math.max(0, rect.top - 14);
  label.style.left = `${rect.left}px`;
  label.style.top = `${top}px`;
  label.style.background = "red";
  label.style.color = "white";
  label.style.fontSize = "12px";
  label.style.fontWeight = "bold";
  label.style.padding = "0 3px";
  label.style.border = "1px solid black";
  label.style.zIndex = 999999;
  label.style.pointerEvents = "none";
  document.body.appendChild(label);
  highlightLabels.push(label);
}
