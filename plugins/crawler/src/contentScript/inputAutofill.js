/* global chrome */

export const DEFAULT_AUTOFILL_FALLBACK_TEXT =
  "Hello! I am your AI agent. I can fill this form for you automatically.";
export const AUTOFILL_MIN_DELAY = 10;
export const AUTOFILL_MAX_DELAY = 40;

const JOB_DESCRIPTION_STORAGE_KEY = "autolancerJobDescription";
const API_BASE_URL_STORAGE_KEY = "spiritApiBaseUrl";

function normalizeWhitespace(text) {
  return (text == null ? "" : String(text)).replace(/\s+/g, " ").trim();
}

function clamp(text, max = 500) {
  const value = normalizeWhitespace(text);
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function getLabelTextForInput(input) {
  if (!input) return "";
  const id = input.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) return normalizeWhitespace(label.innerText || label.textContent || "");
  }
  const closestLabel = input.closest("label");
  if (closestLabel)
    return normalizeWhitespace(closestLabel.innerText || closestLabel.textContent || "");

  const ariaLabelledby = input.getAttribute("aria-labelledby");
  if (ariaLabelledby) {
    const ids = ariaLabelledby.split(/\s+/).filter(Boolean);
    const parts = ids
      .map((lid) => {
        const el = document.getElementById(lid);
        return el ? normalizeWhitespace(el.innerText || el.textContent || "") : "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  return "";
}

export function buildFieldContext(input) {
  if (!input) return "";
  const label = getLabelTextForInput(input);
  const placeholder = input.getAttribute("placeholder") || "";
  const ariaLabel = input.getAttribute("aria-label") || "";
  const name = input.getAttribute("name") || "";
  const id = input.getAttribute("id") || "";
  const type = (input.getAttribute("type") || input.type || "").toLowerCase();

  // Try to capture a small relevant surrounding text block (but keep it short).
  const container =
    input.closest(
      "fieldset, section, article, li, .field, .form-group, .formField, .input-group, div",
    ) || input.parentElement;
  const nearbyText = container
    ? clamp(container.innerText || container.textContent || "", 700)
    : "";

  return clamp(
    [label, ariaLabel, placeholder, name, id, type, nearbyText].filter(Boolean).join(" "),
    900,
  );
}

export async function readJobDescription() {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return "";
    const result = await chrome.storage.local.get(JOB_DESCRIPTION_STORAGE_KEY);
    return typeof result?.[JOB_DESCRIPTION_STORAGE_KEY] === "string"
      ? result[JOB_DESCRIPTION_STORAGE_KEY]
      : "";
  } catch {
    return "";
  }
}

export async function fetchAutofillAnswer(context, jobDescription) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      reject(new Error("chrome.runtime.sendMessage not available"));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("Autofill request timed out"));
    }, 15000);

    try {
      chrome.runtime.sendMessage(
        { action: "autofillField", payload: { context, jobDescription } },
        (response) => {
          clearTimeout(timeout);
          if (!response?.success) {
            reject(new Error(response?.error || "Autofill request failed"));
            return;
          }
          const value = response?.data?.value;
          resolve(typeof value === "string" ? value : "");
        },
      );
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}
