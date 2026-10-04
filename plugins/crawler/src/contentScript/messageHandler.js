import { findLowestCommonAncestor, findElements, waitForElements } from "./elementFinder";
import { isVisible } from "./domUtils";
import { clearHighlights, highlightByPattern as doHighlightByPattern } from "./highlighter";
import { performActionOnElement } from "./actionExecutor";
import { matchesSubmitKeyword } from "./submitDetector";

/* global chrome */

// --- HELPER FUNCTIONS ---

/**
 * Normalizes text by trimming and collapsing all internal whitespace to a single space.
 * This makes string comparisons much more reliable.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  if (!text) return "";
  return text.trim().replace(/\s+/g, " ");
}

/**
 * (This helper is from the previous version, it remains correct)
 * Finds the meaningful "control group" for an input like a checkbox or radio.
 * @param {HTMLInputElement} inputEl The input element.
 * @returns {HTMLElement} The label element or the original input.
 */
function findControlGroupForInput(inputEl) {
  if (inputEl.innerText.trim() !== "") return inputEl;
  if (inputEl.id) {
    const label = document.querySelector(`label[for="${inputEl.id}"]`);
    if (label) return label;
  }
  const parentLabel = inputEl.closest("label");
  if (parentLabel) return parentLabel;
  return inputEl;
}

// --- THE NEW, ROBUST PARENT FINDER ---

/**
 * Travels up the DOM tree to find the smallest ancestor that contains meaningful
 * text content beyond just the starting node's own text.
 * @param {HTMLElement} startNode The red-highlighted element/group.
 * @returns {HTMLElement} The meaningful parent component.
 */
function findMeaningfulParent(startNode) {
  const startNodeText = normalizeText(startNode.innerText);
  let currentParent = startNode.parentElement;

  // Loop upwards until we hit the top of the document.
  while (currentParent) {
    // Stop if we hit a major structural boundary. This is a safeguard.
    const tagName = currentParent.tagName.toUpperCase();
    if (["FORM", "FIELDSET", "MAIN", "BODY"].includes(tagName)) {
      break;
    }

    const parentText = normalizeText(currentParent.innerText);

    // THE CORE LOGIC:
    // If the parent's text is different from the child's, we've found
    // the component boundary.
    if (parentText !== startNodeText) {
      return currentParent;
    }

    // Otherwise, the parent is just a simple wrapper, so we continue climbing.
    currentParent = currentParent.parentElement;
  }

  // If the loop finishes (e.g., we hit a safeguard), return the last valid parent.
  return currentParent || startNode.parentElement || document.body;
}

/**
 * Serializes an HTMLElement into a structured object containing its tag and key properties.
 * @param {HTMLElement} element The element to serialize.
 * @returns {Object|null} A structured object or null if the element is invalid.
 */
function serializeElement(element) {
  if (!element || typeof element.tagName !== "string") {
    return null;
  }

  const properties = {};
  for (const attr of Array.from(element.attributes || [])) {
    properties[attr.name] = attr.value;
  }

  const out = {
    tag: element.tagName.toLowerCase(),
    properties,
    innerText: element.innerText ?? "",
    innerHTML: element.innerHTML, // inner markup for content-level inspection
    outerHTML: element.outerHTML, // include wrapping tag + attributes so callers can reconstruct the full element
  };

  if (element instanceof HTMLSelectElement) {
    out.options = Array.from(element.options || []).map((opt) => ({
      value: opt?.value ?? "",
      text: (opt?.textContent ?? "").trim(),
    }));
  }

  return out;
}

function aggregateChildrenText(children) {
  if (!Array.isArray(children) || children.length === 0) return "";
  const combined = children
    .map((child) => child?.innerText ?? "")
    .filter(Boolean)
    .join(" ");
  return normalizeText(combined);
}

function ensureContextualParents(parentChildMap) {
  const contextualMap = new Map();

  for (const [parent, children] of parentChildMap.entries()) {
    const combinedChildText = aggregateChildrenText(children);
    let finalParent = parent;
    let guard = 0;

    while (guard < 10) {
      const parentText = normalizeText(finalParent.innerText);
      const parentHasContext =
        parentText && (!combinedChildText || parentText !== combinedChildText);
      if (parentHasContext) {
        break;
      }
      const nextParent = findMeaningfulParent(finalParent);
      if (!nextParent || nextParent === finalParent) {
        break;
      }
      finalParent = nextParent;
      guard++;
    }

    if (!contextualMap.has(finalParent)) {
      contextualMap.set(finalParent, []);
    }
    contextualMap.get(finalParent).push(...children);
  }

  return contextualMap;
}

function markDetected(element, variant = "child") {
  if (!element || !(element instanceof Element)) return;
  element.setAttribute("data-autolancer-highlight", variant || "child");
}

function findSelect2UnderlyingSelect(container) {
  if (!container) return null;
  const id = container.getAttribute?.("id") || "";
  if (id && id.startsWith("s2id_")) {
    const originalId = id.slice("s2id_".length);
    const candidate = document.getElementById(originalId);
    if (candidate instanceof HTMLSelectElement) return candidate;
  }
  const inside = container.querySelector?.("select");
  if (inside instanceof HTMLSelectElement) return inside;
  const prev = container.previousElementSibling;
  if (prev instanceof HTMLSelectElement) return prev;
  return null;
}

/**
 * Groups red-highlighted nodes, highlights parents, and returns the structured data.
 */
function groupAndHighlightComponents(runId) {
  // ... PHASE 1 and PHASE 2 remain exactly the same ...
  const highlightedNodes = document.querySelectorAll("[data-highlighter-outline]");
  const parentChildMap = new Map();
  const processedChildren = new Set();

  const fieldsets = document.querySelectorAll("fieldset");
  for (const fieldset of fieldsets) {
    const childrenInFieldset = Array.from(fieldset.querySelectorAll("[data-highlighter-outline]"));
    if (childrenInFieldset.length > 0) {
      parentChildMap.set(fieldset, childrenInFieldset);
      for (const child of childrenInFieldset) {
        processedChildren.add(child);
      }
    }
  }

  for (const node of highlightedNodes) {
    if (processedChildren.has(node)) continue;
    let parentComponent;
    const treatAsStandalone =
      matchesSubmitKeyword(node) &&
      (node.tagName === "BUTTON" ||
        node.matches('input[type="submit"], input[type="button"], [role="button"], a'));
    if (treatAsStandalone) {
      parentComponent = node;
    } else {
      parentComponent = findMeaningfulParent(node);
    }
    if (!parentChildMap.has(parentComponent)) {
      parentChildMap.set(parentComponent, []);
    }
    parentChildMap.get(parentComponent).push(node);
  }

  const contextualMap = ensureContextualParents(parentChildMap);

  // --- PHASE 3: MODIFIED to use the new serializer ---
  const resultData = [];
  for (const [parent, children] of contextualMap.entries()) {
    // No visual border/highlight effects; only mark detection attributes.
    if (!parent.hasAttribute("data-highlighter-outline")) markDetected(parent, "parent");
    parent.setAttribute("data-highlighter-parent", "true");
    parent.setAttribute("data-autolancer-group-id", `${runId || "run"}:${resultData.length}`);

    // Assign stable indices to children so actions can target reliably later.
    for (let childIndex = 0; childIndex < children.length; childIndex++) {
      const child = children[childIndex];
      if (child && child.setAttribute) {
        child.setAttribute("data-autolancer-child-index", String(childIndex));
      }
    }

    // If this group contains a Select2 widget, append its underlying <select> (hidden) so backend can see options.
    const select2Container = parent.classList?.contains("select2-container")
      ? parent
      : children.find((c) => c?.classList?.contains("select2-container")) ||
        parent.querySelector?.(".select2-container");
    if (select2Container) {
      const underlyingSelect = findSelect2UnderlyingSelect(select2Container);
      if (underlyingSelect && !children.includes(underlyingSelect)) {
        const nextIndex = children.length;
        children.push(underlyingSelect);
        try {
          underlyingSelect.setAttribute("data-autolancer-child-index", String(nextIndex));
        } catch {
          // best effort
        }
      }
    }

    // *** THIS IS THE CHANGED PART ***
    // Instead of outerHTML, we now call serializeElement.
    resultData.push({
      Parent: serializeElement(parent),
      Children: children.map(serializeElement), // Use .map to serialize each child
    });
  }

  return resultData;
}

export const messageHandler = (request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case "EXTRACT_MAIN_CONTENT": {
          // Determine minimal container (LCA) that contains all visible interactables
          const allInteractive = Array.from(
            document.querySelectorAll(
              'input:not([type="hidden"]),select,textarea,button,[role="button"]',
            ),
          ).filter(isVisible);
          let container = allInteractive[0] || document.body;
          if (allInteractive.length > 1) {
            container = findLowestCommonAncestor(allInteractive) || container;
          }
          const mainContent = container.innerText;
          sendResponse && sendResponse({ mainContent });
          break;
        }
        case "FIND_INTERACTABLE_ELEMENTS": {
          const elements = Array.from(document.querySelectorAll("input, select, textarea, button"));
          const interactableElements = elements.map((element) => ({
            tagName: element.tagName,
            type: element.type,
            name: element.name,
            id: element.id,
            placeholder: element.placeholder,
            ariaLabel: element.getAttribute("aria-label"),
          }));
          sendResponse && sendResponse({ interactableElements });
          break;
        }
        case "highlightByPattern": {
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
          break;
        }
        case "clearHighlight": {
          clearHighlights();
          break;
        }

        case "executeAction": {
          try {
            const payload = request.payload || {};
            const { action, fetchType, identifier, componentType, propertyName, pattern } = payload;
            if (action === "fetch") {
              // Resolve target element(s)
              let elements = findElements(componentType, propertyName, pattern);
              if (!elements || elements.length === 0) {
                elements = await waitForElements(componentType, propertyName, pattern, 2000, 100);
              }
              if (!elements || elements.length === 0) {
                chrome.runtime.sendMessage({
                  action: "fetchResult",
                  payload: { identifier, success: false, error: "No elements found" },
                });
                break;
              }
              const idx = Number.isFinite(payload.order)
                ? Math.max(0, parseInt(payload.order, 10))
                : 0;
              const el = elements[idx];
              let data;
              if (fetchType === "text") {
                data = el?.innerText ?? "";
              } else {
                // Default: return outerHTML so callers can parse and extract attributes
                data = el?.outerHTML ?? "";
              }
              chrome.runtime.sendMessage({
                action: "fetchResult",
                payload: { identifier, success: true, data },
              });
            } else {
              // Execute interactive actions (click/fill/typeSmoothly)
              await performActionOnElement(payload);
              // Optionally we could send an acknowledgement to UI if needed later
            }
          } catch (err) {
            console.error("executeAction error:", err);
          }
          break;
        }

        case "executeActionsSequence": {
          const runId = request?.payload?.runId || null;
          const actions = Array.isArray(request?.payload?.actions) ? request.payload.actions : [];
          const results = [];

          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

          try {
            for (let i = 0; i < actions.length; i++) {
              const actionPayload = actions[i];
              const result = await performActionOnElement(actionPayload);
              results.push({ index: i, ...result });
              // Small pause between actions to allow DOM/framework updates to settle.
              await wait(75);
            }

            try {
              chrome.runtime.sendMessage({
                action: "executeActionsSequenceResult",
                payload: { runId, success: true, results },
              });
            } catch (err) {
              console.error("Failed to send executeActionsSequenceResult message:", err);
            }
          } catch (err) {
            console.error("executeActionsSequence error:", err);
            try {
              chrome.runtime.sendMessage({
                action: "executeActionsSequenceResult",
                payload: {
                  runId,
                  success: false,
                  error: String((err && err.message) || err),
                  results,
                },
              });
            } catch (e) {
              console.error("Failed to send executeActionsSequenceResult error message:", e);
            }
          }
          break;
        }

        case "executeActionsParallel": {
          const runId = request?.payload?.runId || null;
          const actions = Array.isArray(request?.payload?.actions) ? request.payload.actions : [];

          try {
            const results = await Promise.all(
              actions.map(async (actionPayload, index) => {
                const result = await performActionOnElement(actionPayload);
                return { index, ...result };
              }),
            );

            try {
              chrome.runtime.sendMessage({
                action: "executeActionsParallelResult",
                payload: { runId, success: true, results },
              });
            } catch (err) {
              console.error("Failed to send executeActionsParallelResult message:", err);
            }
          } catch (err) {
            console.error("executeActionsParallel error:", err);
            try {
              chrome.runtime.sendMessage({
                action: "executeActionsParallelResult",
                payload: { runId, success: false, error: String((err && err.message) || err) },
              });
            } catch (e) {
              console.error("Failed to send executeActionsParallelResult error message:", e);
            }
          }
          break;
        }

        case "highlightInteractables": {
          try {
            clearHighlights();

            const INTERACTABLE_CHILD_SELECTOR =
              'input,select,textarea,button,a[href],[role="button"]';

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
              if (
                el.hasAttribute("data-highlighter-outline") ||
                el.closest("[data-highlighter-outline]")
              ) {
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
                targetElement.setAttribute(
                  "data-highlighter-original-outline",
                  originalOutline || "",
                );
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
          break;
        }

        // (The clearHighlights function remains the same as the previous version)
        default:
          break;
      }
    } catch (e) {
      console.error("messageHandler error:", e);
      // Best-effort error response for the two async sendResponse cases
      if (
        typeof sendResponse === "function" &&
        (request.action === "EXTRACT_MAIN_CONTENT" ||
          request.action === "FIND_INTERACTABLE_ELEMENTS")
      ) {
        try {
          sendResponse({ error: String((e && e.message) || e) });
        } catch (e) {
          console.error("Failed to send error response:", e);
        }
      }
    }
  })();
  // Keep the channel open only for actions that use sendResponse
  return (
    request.action === "EXTRACT_MAIN_CONTENT" || request.action === "FIND_INTERACTABLE_ELEMENTS"
  );
};
