import { clickLikeHuman, wait } from "./dom";
import { isReactSelectInput, selectFromReactSelect } from "./reactSelect";
import { getSelect2Container, getUnderlyingSelectForSelect2, selectFromSelect2 } from "./select2";
import { extractQuotedPhrases, normalizeText } from "./selectionText";
import { typeSmoothly } from "./typing";

async function selectFromAriaDropdown(element, selectionText) {
  if (isReactSelectInput(element)) {
    return selectFromReactSelect(element, selectionText);
  }

  const candidates = [...extractQuotedPhrases(selectionText), selectionText].filter(Boolean);
  const desired = candidates[0] || "";

  try {
    element.focus?.();
  } catch {
    /* best effort */
  }
  clickLikeHuman(element);

  await wait(100);

  // Some widgets accept typing to filter/select.
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    await typeSmoothly(element, desired);
  }

  try {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
  } catch {
    // best effort
  }

  return { success: true };
}

export async function selectByText(element, selectionText) {
  if (!element) return { success: false, error: "No element" };

  // Native <select>
  if (element instanceof HTMLSelectElement) {
    const desired = normalizeText(selectionText);
    if (!desired) return { success: false, error: "No selection text provided" };

    const option =
      Array.from(element.options || []).find(
        (opt) => normalizeText(opt?.textContent || "") === desired,
      ) ||
      Array.from(element.options || []).find((opt) =>
        normalizeText(opt?.textContent || "").includes(desired),
      );

    if (!option) {
      return { success: false, error: `No matching option for: ${selectionText}` };
    }

    element.value = option.value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true };
  }

  // Select2 / JS dropdown (e.g. role="button" + aria-haspopup or select2-focusser)
  if (getSelect2Container(element)) {
    return selectFromSelect2(element, selectionText);
  }

  const role = (element.getAttribute?.("role") || "").toLowerCase();
  const isAriaDropdown =
    element.getAttribute?.("aria-haspopup") === "true" || role === "button" || role === "combobox";
  if (isAriaDropdown) {
    return selectFromAriaDropdown(element, selectionText);
  }

  return { success: false, error: "Target is not a <select> or supported dropdown" };
}

export async function selectByIndex(element, selectedIndex) {
  if (!element) return { success: false, error: "No element" };
  const idx = Number.isFinite(selectedIndex) ? selectedIndex : parseInt(selectedIndex, 10);
  if (!Number.isFinite(idx) || idx < 0) return { success: false, error: "Invalid selectedIndex" };

  if (element instanceof HTMLSelectElement) {
    if (!element.options || idx >= element.options.length) {
      return { success: false, error: `selectedIndex ${idx} out of range` };
    }
    const option = element.options[idx];
    element.value = option.value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true };
  }

  // If a Select2 container/input was passed, resolve to its underlying <select> and select there.
  if (getSelect2Container(element)) {
    const container = getSelect2Container(element);
    const underlyingSelect = getUnderlyingSelectForSelect2(container);
    if (underlyingSelect) return selectByIndex(underlyingSelect, idx);
  }

  return { success: false, error: "Target is not a <select> or supported dropdown" };
}
