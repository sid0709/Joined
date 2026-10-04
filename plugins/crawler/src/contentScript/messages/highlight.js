/* global chrome */
import {
  findControlGroupForInput,
  groupAndHighlightComponents,
  markDetected,
} from "../componentGrouping";
import { isVisible } from "../domUtils";
import { clearHighlights, highlightByPattern as doHighlightByPattern } from "../highlighter";
import { matchesSubmitKeyword } from "../submitDetector";

export function handleHighlightByPattern(request) {
  const { componentType, propertyName, pattern, color } = request.payload || {};
  clearHighlights();
  const result = doHighlightByPattern(
    componentType || "*",
    propertyName || "id",
    pattern || "",
    color || "red",
  );
  try {
    chrome.runtime.sendMessage({
      action: "highlightResult",
      payload: {
        success: true,
        matched: result?.matched ?? 0,
        highlighted: result?.highlighted ?? 0,
        pattern: pattern || "",
      },
    });
  } catch (e) {
    console.error("Failed to send highlightResult", e);
  }
}

export function handleHighlightInteractables(request) {
  try {
    clearHighlights();

    const INTERACTABLE_CHILD_SELECTOR = 'input,select,textarea,button,a[href],[role="button"]';

    // ** FIX 1: REMOVED 'fieldset' from this selector. **
    // A fieldset is a container, not an interactable element itself.
    // We also add `a[href]` to be more explicit about links.
    const selector =
      'input:not([type="hidden"]),select,textarea,button,[role="button"],[tabindex],a[href]';

    const nodes = Array.from(document.querySelectorAll(selector))
      // Include hidden <input type="file"> elements so uploads can be automated
      // even when the UI uses a custom "Upload" button.
      .filter((el) => isVisible(el) || el.matches?.('input[type="file"]'))
      .filter((el) => {
        if (!el.hasAttribute("tabindex")) return true;
        const hasInteractableChildren = el.querySelector(INTERACTABLE_CHILD_SELECTOR);
        return !hasInteractableChildren;
      });

    for (const el of nodes) {
      if (el.hasAttribute("data-highlighter-outline") || el.closest("[data-highlighter-outline]")) {
        continue;
      }
      let targetElement = el;

      // This logic now correctly processes radios inside a fieldset.
      if (el.matches('input[type="checkbox"], input[type="radio"]')) {
        // For radio/checkboxes, we find the containing label or div to highlight the whole unit.
        targetElement = findControlGroupForInput(el);
      }

      try {
        const originalOutline = targetElement.style.outline;
        targetElement.setAttribute("data-highlighter-original-outline", originalOutline || "");
        targetElement.setAttribute("data-highlighter-outline", "true");
        const variant = matchesSubmitKeyword(targetElement) ? "submit" : "child";
        markDetected(targetElement, variant);
      } catch (e) {
        console.error("applyHighlight error for element:", el, e);
      }
    }

    const runId = request?.payload?.runId || null;
    const componentData = groupAndHighlightComponents(runId);
    console.log("Detected Component Structure:", componentData);

    // Send the structured result back to the extension UI via background
    try {
      chrome.runtime.sendMessage({
        action: "interactablesResult",
        payload: { components: componentData, runId },
      });
    } catch (err) {
      console.error("Failed to send interactablesResult message:", err);
    }
  } catch (e) {
    console.error("highlightInteractables error:", e);
  }
}
