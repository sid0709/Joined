import { matchesSubmitKeyword } from "./submitDetector";

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
export function findControlGroupForInput(inputEl) {
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

export function markDetected(element, variant = "child") {
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
export function groupAndHighlightComponents(runId) {
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
