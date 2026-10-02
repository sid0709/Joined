import { isChoiceSelected, isChoiceWidget } from "./choice-state";

const PLACEHOLDER_VALUES = new Set(["", "select...", "select", "choose...", "choose"]);

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Linguistic empty-state labels (not vendor-specific strings). */
function isPlaceholder(text: string): boolean {
  const n = normalize(text);
  if (PLACEHOLDER_VALUES.has(n)) return true;
  const stripped = n.replace(/^[—\-–•·.|]+|[—\-–•·.|]+$/g, "").trim();
  if (!stripped) return true;
  return /^(select(\s|$)|choose(\s|$)|pick(\s|$)|make a selection|type to search|please select)/i.test(
    stripped,
  );
}

/**
 * React-select and similar widgets keep the chosen label in a sibling node;
 * the combobox <input> value is often empty after selection.
 */
function readComboboxDisplayValue(el: Element): string {
  const html = el as HTMLElement;
  const roots: Element[] = [];
  const closestControl = html.closest(
    '[class*="control"], [class*="Control"], [class*="select"], [class*="Select"], [role="group"]',
  );
  if (closestControl) roots.push(closestControl);
  if (html.parentElement) roots.push(html.parentElement);
  if (html.parentElement?.parentElement) roots.push(html.parentElement.parentElement);
  roots.push(html);

  const valueSelectors = [
    '[class*="single-value"]',
    '[class*="singleValue"]',
    '[class*="multi-value__label"]',
    '[class*="multiValue"]',
    "[data-value]",
    '[aria-selected="true"]',
  ];

  for (const root of roots) {
    const parts: string[] = [];
    for (const selector of valueSelectors) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        if (node.contains(el) && node !== el) continue;
        const text = ((node as HTMLElement).innerText || node.textContent || "").trim();
        if (!text || isPlaceholder(text)) continue;
        if (!parts.includes(text)) parts.push(text);
      }
    }
    if (parts.length) return parts.join(", ");
  }

  const own = (html.innerText || html.textContent || "").replace(/\s+/g, " ").trim();
  if (own && !isPlaceholder(own)) return own;

  const aria = html.getAttribute("aria-valuetext") || html.getAttribute("data-value");
  if (aria && !isPlaceholder(aria)) return aria.trim();

  return "";
}

function isComboboxControl(el: HTMLElement): boolean {
  const role = (el.getAttribute("role") || "").toLowerCase();
  return (
    role === "combobox" ||
    el.getAttribute("aria-haspopup") === "listbox" ||
    el.getAttribute("aria-haspopup") === "true" ||
    el.getAttribute("aria-autocomplete") === "list" ||
    (el.hasAttribute("aria-expanded") && el.hasAttribute("aria-controls"))
  );
}

/** Read the user-visible value of a form control for validate / reporting. */
export function readControlValue(el: Element | null): string {
  if (!el) return "";

  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") return String(el.checked);
    if (el.type === "file") {
      return Array.from(el.files ?? [])
        .map((f) => f.name)
        .join(", ");
    }

    if (isComboboxControl(el)) {
      const displayed = readComboboxDisplayValue(el);
      if (displayed) return displayed;
    }

    return el.value;
  }

  if (el instanceof HTMLSelectElement) {
    const selected = el.selectedOptions?.[0];
    const label = (selected?.textContent || selected?.label || el.value || "").trim();
    if (label && !isPlaceholder(label)) return label;

    // Enhanced selects often leave the native control empty while the widget shows the value.
    const parent = el.parentElement;
    if (parent) {
      const combo = parent.querySelector('[role="combobox"]');
      if (combo) {
        const displayed = readComboboxDisplayValue(combo);
        if (displayed) return displayed;
      }
    }
    return "";
  }

  if (el instanceof HTMLTextAreaElement) return el.value;

  const role = ((el as HTMLElement).getAttribute("role") || "").toLowerCase();
  if (role === "option" || el instanceof HTMLOptionElement) {
    const selected =
      el instanceof HTMLOptionElement
        ? el.selected
        : (el as HTMLElement).getAttribute("aria-selected") === "true";
    if (!selected) return "";
    const text = (
      (el as HTMLElement).getAttribute("aria-label") ||
      (el instanceof HTMLOptionElement ? el.label || el.text : "") ||
      (el as HTMLElement).innerText ||
      (el as HTMLElement).textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    return isPlaceholder(text) ? "" : text;
  }

  if (isComboboxControl(el as HTMLElement)) {
    const displayed = readComboboxDisplayValue(el);
    if (displayed) return displayed;
  }

  // Choice widgets always contain their option label; that is not a filled value
  // unless the control is actually selected.
  if (isChoiceWidget(el) && !isChoiceSelected(el)) return "";

  const text = ((el as HTMLElement).innerText || el.textContent || "").trim();
  return isPlaceholder(text) ? "" : text;
}
