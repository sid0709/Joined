import { clickLikeHuman, setNativeValue, wait } from "./dom";
import { deriveSelectionCandidates, findBestMatchingNode } from "./selectionText";
import { typeSmoothly } from "./typing";

export function isReactSelectInput(element) {
  if (!element || !(element instanceof Element)) return false;
  if (element.classList?.contains("select__input")) return true;
  // Greenhouse uses react-select with surrounding classes like select__control/select__container.
  if (element.closest?.(".select__control, .select__container, .select-shell")) return true;
  return false;
}

async function waitForReactSelectListbox(inputEl, timeoutMs = 2000) {
  const start = Date.now();
  const inputId = inputEl?.getAttribute?.("id") || "";
  const expectedListboxId = inputId ? `react-select-${inputId}-listbox` : "";

  while (Date.now() - start < timeoutMs) {
    const ariaControls = inputEl?.getAttribute?.("aria-controls") || "";
    if (ariaControls) {
      const byAria = document.getElementById(ariaControls);
      if (byAria) return byAria;
    }

    if (expectedListboxId) {
      const byId = document.getElementById(expectedListboxId);
      if (byId) return byId;
    }

    // Menu can be rendered via portal at document body level.
    const menu = document.querySelector(".select__menu");
    if (menu) return menu;

    // Generic fallback: visible listbox near the input.
    const listboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
    const visible = listboxes.find((lb) => lb && lb.offsetParent !== null);
    if (visible) return visible;

    await wait(50);
  }
  return null;
}

// eslint-disable-next-line complexity -- react-select fallbacks tried in order; splitting them is a behavior change
export async function selectFromReactSelect(target, selectionText, options = {}) {
  const candidates = deriveSelectionCandidates(selectionText);
  const desired = candidates[0] || "";
  const selectedIndex = Number.isFinite(options.selectedIndex)
    ? options.selectedIndex
    : parseInt(options.selectedIndex, 10);

  const control =
    target?.closest?.(".select__control") ||
    target?.closest?.(".select__container") ||
    target?.closest?.(".select-shell") ||
    target;
  const inputEl =
    target instanceof HTMLInputElement &&
    (target.getAttribute?.("role") || "").toLowerCase() === "combobox"
      ? target
      : control?.querySelector?.('input.select__input, input[role="combobox"]') ||
        target?.querySelector?.('input.select__input, input[role="combobox"]') ||
        null;

  const toggle = control?.querySelector?.(
    'button[aria-label="Toggle flyout"], button[aria-label*="Toggle"]',
  );

  // React-Select commonly opens on mousedown on the control.
  try {
    inputEl?.focus?.();
  } catch {
    /* best effort */
  }
  if (control && control !== inputEl) {
    try {
      control.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    } catch {
      /* best effort */
    }
  }
  if (toggle) clickLikeHuman(toggle);
  if (inputEl) clickLikeHuman(inputEl);

  await wait(100);

  // Type to filter options (react-select commonly uses this).
  if (inputEl && desired) {
    try {
      setNativeValue(inputEl, "");
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {
      /* best effort */
    }
    await typeSmoothly(inputEl, desired, { minDelayMs: 5, maxDelayMs: 15 });
    await wait(100);
  }

  const listbox = await waitForReactSelectListbox(inputEl || target, 3000);
  if (!listbox) return { success: false, error: "React-Select listbox did not open" };

  const optionNodes = Array.from(
    listbox.querySelectorAll('[role="option"], .select__option'),
  ).filter(Boolean);

  if (Number.isFinite(selectedIndex) && selectedIndex >= 0 && selectedIndex < optionNodes.length) {
    const node = optionNodes[selectedIndex];
    node.scrollIntoView?.({ block: "nearest" });
    try {
      node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    } catch {
      /* best effort */
    }
    try {
      node.click?.();
    } catch {
      /* best effort */
    }
    return { success: true };
  }

  for (const candidate of candidates) {
    const match = findBestMatchingNode(optionNodes, candidate);
    if (!match) continue;
    match.scrollIntoView?.({ block: "nearest" });
    try {
      match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    } catch {
      /* best effort */
    }
    try {
      match.click?.();
    } catch {
      /* best effort */
    }
    return { success: true };
  }

  // Last resort: attempt keyboard selection (first result).
  try {
    (inputEl || target)?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    (inputEl || target)?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    (inputEl || target)?.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    return { success: true };
  } catch {
    return { success: false, error: "No matching React-Select option found" };
  }
}
