/**
 * Finds elements based on component type, a specific property, and a pattern.
 * @param {string} componentType The tag name of the element (e.g., 'div', 'input').
 * @param {string} propertyName The attribute to search against (e.g., 'id', 'class', 'name', 'href').
 * @param {string} pattern The pattern to match against the property's value.
 *   - 'text?' -> starts with 'text'
 *   - '?text?' -> contains 'text'
 *   - '?text' -> ends with 'text'
 *   - 'text' -> exact match
 * @returns {NodeListOf<HTMLElement>} A collection of matching elements.
 */
function escapeAttrSelectorValue(value) {
  // Escape characters that break CSS attribute selector values inside double quotes.
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

export function findElements(componentType, propertyName, pattern) {
  const tag = componentType || "*";
  // In CSS attribute selectors the HTML attribute is "class" (not className).
  const attr = propertyName === "className" ? "class" : propertyName || "id";
  const raw = pattern || "";
  let needle;
  let matcher; // *= contains, ^= starts-with, $= ends-with, = exact
  if (raw.startsWith("?") && raw.endsWith("?") && raw.length >= 2) {
    needle = raw.slice(1, -1);
    matcher = "*=";
  } else if (raw.endsWith("?")) {
    needle = raw.slice(0, -1);
    matcher = "^=";
  } else if (raw.startsWith("?")) {
    needle = raw.slice(1);
    matcher = "$=";
  } else {
    needle = raw;
    matcher = "=";
  }
  const selector = `${tag}[${attr}${matcher}"${escapeAttrSelectorValue(needle)}"]`;
  try {
    return document.querySelectorAll(selector);
  } catch (e) {
    console.error("findElements invalid selector", selector, e);
    return [];
  }
}

// Wait up to timeoutMs for elements to appear (polling). Returns NodeList or null.
export function waitForElements(
  componentType,
  propertyName,
  pattern,
  timeoutMs = 2000,
  intervalMs = 100,
) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const els = findElements(componentType, propertyName, pattern);
      if (els && els.length > 0) return resolve(els);
      if (Date.now() - start >= timeoutMs) return resolve(null);
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function getAncestors(element) {
  const ancestors = new Set();
  let current = element;
  while (current) {
    ancestors.add(current);
    current = current.parentNode;
  }
  return ancestors;
}

function findLCAOfTwo(el1, el2) {
  // Handle cases where elements are null or not valid DOM elements
  if (!(el1 instanceof Element) || !(el2 instanceof Element)) {
    return null;
  }
  // If elements are the same, that element is their LCA
  if (el1 === el2) {
    return el1;
  }

  // Get all ancestors of the first element
  const ancestors1 = getAncestors(el1); //[1][2]

  // Traverse up from the second element, checking if each ancestor is in the first element's ancestor set
  let current = el2;
  while (current) {
    if (ancestors1.has(current)) {
      return current; // Found the first common ancestor
    }
    current = current.parentNode; // Move up to the parent node[1][3]
  }

  return null; // No common ancestor found (e.g., elements are in different documents or detached)
}

export function findLowestCommonAncestor(elements) {
  // Handle empty or non-array input
  if (!Array.isArray(elements) || elements.length === 0) {
    return null;
  }

  // Filter out any non-Element or null entries to ensure valid processing
  const validElements = elements.filter((el) => el instanceof Element);

  // If no valid elements remain after filtering
  if (validElements.length === 0) {
    return null;
  }
  // If there's only one valid element, it is its own LCA
  if (validElements.length === 1) {
    return validElements[0];
  }

  // Initialize the LCA with the first valid element
  let lca = validElements[0];

  // Iteratively find the LCA of the current LCA and the next element in the array
  for (let i = 1; i < validElements.length; i++) {
    lca = findLCAOfTwo(lca, validElements[i]);
    if (!lca) {
      // If at any point no common ancestor is found between the current LCA and the next element,
      // then there's no common ancestor for the entire set.
      return null;
    }
  }

  return lca;
}
