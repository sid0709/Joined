import { ensureAgentStyles } from "./agentStyles";
import { AutolancerInputController } from "./inputController";

// STRICTER SELECTOR: Explicitly excludes buttons, checkboxes, radios, range, etc.
const INPUT_SELECTOR = `
	textarea:not([disabled]):not([readonly]),
	input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="image"]):not([type="range"]):not([type="color"]):not([disabled]):not([readonly])
`;

// Allowed types for the logic check
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "password", "number", "tel"]);

const controllers = new Map();
let mutationObserver = null;
let effectsEnabled = false;

function shouldEnhanceInput(element) {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    const type = (element.getAttribute("type") || "text").toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

function ensureController(element) {
  // Double check logic to ensure we never attach to a button or checkbox
  if (!shouldEnhanceInput(element)) return;
  if (controllers.has(element)) return;

  const controller = new AutolancerInputController(element);
  controllers.set(element, controller);
}

function removeStaleControllers() {
  controllers.forEach((controller, element) => {
    if (!document.contains(element)) {
      controller.destroy();
      controllers.delete(element);
    }
  });
}

function startObserver() {
  if (mutationObserver || !document?.body) return;
  mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes?.forEach((node) => {
        if (!(node instanceof Element)) return;

        // Check the node itself
        if (node.matches && node.matches(INPUT_SELECTOR)) {
          ensureController(node);
        }

        // Check children
        if (node.querySelectorAll) {
          node.querySelectorAll(INPUT_SELECTOR).forEach((el) => ensureController(el));
        }
      });
    });
    removeStaleControllers();
  });
  try {
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    console.error("autolancer inputEffects observer failed", e);
  }
}

function stopObserver() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
}

export function enableAutolancerInputEffects() {
  ensureAgentStyles();
  if (!document?.body) return;

  // Initial scan with stricter selector
  const elements = document.querySelectorAll(INPUT_SELECTOR);
  elements.forEach((element) => ensureController(element));

  removeStaleControllers();
  if (!effectsEnabled) {
    startObserver();
    effectsEnabled = true;
  }
}

export function disableAutolancerInputEffects() {
  controllers.forEach((controller) => controller.destroy());
  controllers.clear();
  stopObserver();
  effectsEnabled = false;
}
