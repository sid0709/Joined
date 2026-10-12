import { HEART_INNER, HEART_PREFIX_SAVED, HEART_SAVED_CLASS } from "./constants.js";

/** `className` as a space-separated string (string, list, or DOMTokenList). */
export function classListText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  if (typeof value.toString === "function") return String(value);
  return "";
}

/**
 * Saved is `div.heart.saved` (svg data-prefix=fas). The host `status` attribute
 * can be stale, so callers must pass the shadow-DOM class / prefix.
 */
export function isHeartSaved({ classes = "", prefix = "" } = {}) {
  if (new RegExp(`\\b${HEART_SAVED_CLASS}\\b`).test(classListText(classes))) return true;
  return prefix === HEART_PREFIX_SAVED;
}

/** Read an open shadow root (or a stand-in root in tests) for the list-card heart. */
export function heartStateFromRoot(root) {
  if (!root?.querySelector) return { found: false, saved: false, classes: "", prefix: "" };
  const heart = root.querySelector(HEART_INNER);
  if (!heart) return { found: false, saved: false, classes: "", prefix: "" };
  const svg = heart.querySelector("[data-prefix]");
  const classes = classListText(heart.className || heart.getAttribute?.("class"));
  const prefix = svg?.getAttribute?.("data-prefix") || "";
  return {
    found: true,
    saved: isHeartSaved({ classes, prefix }),
    classes,
    prefix,
  };
}
