import { findElements, waitForElements } from "../elementFinder";

import { isReactSelectInput, selectFromReactSelect } from "./reactSelect";
import { selectByIndex, selectByText } from "./selectOptions";

function getScopedChildren(parentElement) {
  if (!parentElement) return [];
  const outlined = Array.from(parentElement.querySelectorAll("[data-highlighter-outline]"));
  if (outlined.length) return outlined;
  return Array.from(
    parentElement.querySelectorAll('input,textarea,button,a[href],[role="button"]'),
  );
}

export async function resolveScopedTarget(payload) {
  const scope = payload?.scope;
  if (!scope) return null;
  const { componentType, propertyName, pattern, order } = scope;

  let parents = findElements(componentType, propertyName, pattern);
  if (!parents || parents.length === 0) {
    parents = await waitForElements(componentType, propertyName, pattern, 2000, 100);
  }
  if (!parents || parents.length === 0) return null;

  const parentIndex = Number.isFinite(order) ? Math.max(0, parseInt(order, 10)) : 0;
  const parentElement = parents[parentIndex] || parents[0];
  if (!parentElement) return null;

  const childIndex = Number.isFinite(payload.childIndex)
    ? payload.childIndex
    : parseInt(payload.childIndex, 10);
  if (Number.isFinite(childIndex) && childIndex >= 0) {
    const byIndexAttr = parentElement.querySelector?.(
      `[data-autolancer-child-index="${childIndex}"]`,
    );
    if (byIndexAttr) return byIndexAttr;

    const children = getScopedChildren(parentElement);
    if (childIndex < children.length) return children[childIndex];
  }

  return null;
}

export async function performScopedSelect(payload) {
  const scopedTarget = await resolveScopedTarget(payload);
  if (!scopedTarget) return { success: false, error: "Scoped target not found" };

  const selectedIndex = payload?.selectedIndex;
  if (selectedIndex !== undefined && selectedIndex !== null) {
    // Native <select> / Select2 path
    const byIndex = await selectByIndex(scopedTarget, selectedIndex);
    if (byIndex.success) return { success: true };

    // React-Select path (Greenhouse EEO dropdowns)
    if (
      isReactSelectInput(scopedTarget) ||
      (scopedTarget.getAttribute?.("role") || "").toLowerCase() === "combobox"
    ) {
      const byReactIndex = await selectFromReactSelect(scopedTarget, payload?.value || "", {
        selectedIndex,
      });
      if (byReactIndex.success) return { success: true };
    }
  }

  const selectionText = payload?.value;
  const selectResult = await selectByText(scopedTarget, selectionText);
  if (!selectResult.success) return selectResult;
  return { success: true };
}
