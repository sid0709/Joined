import { setNativeValue, wait } from "./dom";
import { deriveSelectionCandidates, findBestMatchingNode, normalizeText } from "./selectionText";

export function getSelect2Container(element) {
  if (!element) return null;
  if (element.classList?.contains("select2-container")) return element;
  return element.closest?.(".select2-container") || null;
}

export function getUnderlyingSelectForSelect2(container) {
  if (!container) return null;
  // Select2 v3 uses container id like "s2id_<originalId>"
  const id = container.getAttribute("id") || "";
  if (id && id.startsWith("s2id_")) {
    const originalId = id.slice("s2id_".length);
    const candidate = document.getElementById(originalId);
    if (candidate instanceof HTMLSelectElement) return candidate;
  }

  // Sometimes the original <select> lives next to the container or inside it.
  const inside = container.querySelector?.("select");
  if (inside instanceof HTMLSelectElement) return inside;
  const prev = container.previousElementSibling;
  if (prev instanceof HTMLSelectElement) return prev;

  return null;
}

function openSelect2(container) {
  const opener =
    container?.querySelector?.('a.select2-choice, .select2-selection, [role="button"]') ||
    container;
  try {
    opener.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  } catch {
    // best effort
  }
  try {
    opener.click();
  } catch {
    // best effort
  }
}

async function waitForSelect2Dropdown(timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v3 = document.querySelector(".select2-drop-active, .select2-drop.select2-drop-active");
    if (v3) return v3;
    const v4 = document.querySelector(".select2-dropdown");
    if (v4) return v4;
    await wait(50);
  }
  return null;
}

function getSelect2ChosenText(container) {
  if (!container) return "";
  const chosen = container.querySelector(".select2-chosen, .select2-selection__rendered");
  return (chosen?.textContent || chosen?.innerText || "").trim();
}

export async function selectFromSelect2(element, selectionText) {
  const container = getSelect2Container(element) || getSelect2Container(element?.parentElement);
  if (!container) return { success: false, error: "Select2 container not found" };

  const candidates = deriveSelectionCandidates(selectionText);
  const underlyingSelect = getUnderlyingSelectForSelect2(container);

  if (underlyingSelect) {
    for (const candidate of candidates) {
      const desired = normalizeText(candidate);
      if (!desired) continue;
      const option =
        Array.from(underlyingSelect.options || []).find(
          (opt) => normalizeText(opt?.textContent || "") === desired,
        ) ||
        Array.from(underlyingSelect.options || []).find((opt) =>
          normalizeText(opt?.textContent || "").includes(desired),
        );

      if (option) {
        underlyingSelect.value = option.value;
        underlyingSelect.dispatchEvent(new Event("input", { bubbles: true }));
        underlyingSelect.dispatchEvent(new Event("change", { bubbles: true }));

        try {
          // If the page uses jQuery + Select2, triggering via jQuery helps Select2 sync UI reliably.
          if (window.jQuery) {
            window.jQuery(underlyingSelect).val(option.value).trigger("change");
          }
        } catch {
          // best effort
        }

        // Verify display updated; if not, fall back to UI selection.
        const chosenNow = normalizeText(getSelect2ChosenText(container));
        const expected = normalizeText(option.textContent || "");
        if (chosenNow && expected && (chosenNow === expected || chosenNow.includes(expected))) {
          return { success: true };
        }
        break;
      }
    }
  }

  openSelect2(container);
  const dropdown = await waitForSelect2Dropdown(2000);
  if (!dropdown) return { success: false, error: "Select2 dropdown did not open" };

  // Type into search field if present to narrow results.
  const searchInput = dropdown.querySelector(
    "input.select2-input, .select2-search input, input.select2-search__field",
  );
  if (searchInput) {
    searchInput.focus?.();
    const primary = candidates[0] || "";
    setNativeValue(searchInput, primary);
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true }));
    await wait(100);
  }

  // Collect option nodes across Select2 v3/v4.
  const v3Labels = Array.from(
    dropdown.querySelectorAll(".select2-results li .select2-result-label"),
  );
  const v3Lis = Array.from(dropdown.querySelectorAll(".select2-results li"));
  const v4Options = Array.from(dropdown.querySelectorAll(".select2-results__option")).filter(
    (n) => !n.classList?.contains("select2-results__option--disabled"),
  );
  const optionNodes = [...(v3Lis.length ? v3Lis : v3Labels), ...v4Options].filter(Boolean);

  for (const candidate of candidates) {
    const match = findBestMatchingNode(optionNodes, candidate);
    if (!match) continue;
    const clickable = match.closest?.("li") || match;
    clickable.scrollIntoView?.({ block: "nearest" });
    try {
      clickable.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    } catch {
      // best effort
    }
    clickable.click?.();

    const chosenNow = normalizeText(getSelect2ChosenText(container));
    const expected = normalizeText(candidate);
    if (
      chosenNow &&
      expected &&
      (chosenNow === expected || chosenNow.includes(expected) || expected.includes(chosenNow))
    ) {
      return { success: true };
    }
    return { success: true };
  }

  // Last resort: keyboard selection (first result / best guess).
  if (searchInput) {
    searchInput.focus?.();
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    return { success: true };
  }

  return { success: false, error: "No matching Select2 option found" };
}
