import { findElements, waitForElements } from "./elementFinder";
import { clickLikeHuman, setNativeValue } from "./actions/dom";
import { isReactSelectInput, selectFromReactSelect } from "./actions/reactSelect";
import { performScopedSelect, resolveScopedTarget } from "./actions/scoped";
import { selectByIndex, selectByText } from "./actions/selectOptions";
import { typeSmoothly } from "./actions/typing";
import { performUpload } from "./actions/upload";

export { typeSmoothly } from "./actions/typing";
export { selectByIndex, selectByText } from "./actions/selectOptions";

/**
 * Finds a specific element and performs an action on it.
 * @param {object} payload The details of the action to execute.
 */
export async function performActionOnElement(payload) {
  try {
    const { componentType, propertyName, pattern, order, action, value } = payload;

    if (action === "fillScoped" || action === "clickScoped") {
      const scopedTarget = await resolveScopedTarget(payload);
      if (!scopedTarget) return { success: false, error: "Scoped target not found" };

      if (action === "clickScoped") {
        try {
          scopedTarget.focus?.();
        } catch {
          /* best effort */
        }
        clickLikeHuman(scopedTarget);
        return { success: true };
      }

      let fillTarget = scopedTarget;
      if (!(fillTarget instanceof HTMLInputElement || fillTarget instanceof HTMLTextAreaElement)) {
        fillTarget = scopedTarget.querySelector?.("input,textarea") || fillTarget;
      }
      if (!(fillTarget instanceof HTMLInputElement || fillTarget instanceof HTMLTextAreaElement)) {
        return { success: false, error: "Scoped fill target is not an input/textarea" };
      }

      fillTarget.focus?.();
      setNativeValue(fillTarget, value);
      fillTarget.dispatchEvent(new Event("input", { bubbles: true }));
      fillTarget.dispatchEvent(new Event("change", { bubbles: true }));
      return { success: true };
    }

    if (action === "uploadFileScoped") {
      const scopedTarget = await resolveScopedTarget(payload);

      // Best-effort: resolve the scope parent so we can prefer its file inputs.
      let scopeParent = null;
      try {
        const scope = payload?.scope;
        if (scope) {
          const parents = findElements(scope.componentType, scope.propertyName, scope.pattern);
          const parentIndex = Number.isFinite(scope.order)
            ? Math.max(0, parseInt(scope.order, 10))
            : 0;
          scopeParent = (parents && parents[parentIndex]) || (parents && parents[0]) || null;
        }
      } catch {
        /* best effort */
      }

      return await performUpload(payload, scopedTarget, scopeParent);
    }

    if (action === "selectByTextScoped") {
      return await performScopedSelect(payload);
    }

    let elements = findElements(componentType, propertyName, pattern);

    if (!elements || elements.length === 0) {
      console.debug("performAction: no elements found, waiting for DOM updates", {
        componentType,
        propertyName,
        pattern,
      });
      elements = await waitForElements(componentType, propertyName, pattern, 2000, 100);
    }

    if (!elements || elements.length === 0) {
      const msg = "No elements found matching the criteria.";
      console.log(`Action failed: ${msg}`);
      return { success: false, error: msg };
    }

    const idx = Number.isFinite(order) ? Math.max(0, parseInt(order, 10)) : 0;
    if (idx >= elements.length) {
      const msg = `Order is ${idx}, but only ${elements.length} elements were found.`;
      console.log(`Action failed: ${msg}`);
      return { success: false, error: msg };
    }

    const targetElement = elements[idx];
    // For clicks, clickLikeHuman below does its own guarded scroll, so the
    // native focus() auto-scroll is redundant and would otherwise jump the
    // page even when the element is already on-screen. Other actions (fill,
    // typeSmoothly, ...) keep the default scroll-into-view on focus.
    if (targetElement && targetElement.focus) {
      targetElement.focus(action === "click" ? { preventScroll: true } : undefined);
    }

    switch (action) {
      case "click":
        clickLikeHuman(targetElement);
        break;
      case "fill":
        setNativeValue(targetElement, value);
        targetElement.dispatchEvent(new Event("input", { bubbles: true }));
        targetElement.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      case "typeSmoothly":
        await typeSmoothly(targetElement, value);
        break;
      case "selectByText": {
        if (payload?.selectedIndex !== undefined && payload?.selectedIndex !== null) {
          const byIndex = await selectByIndex(targetElement, payload.selectedIndex);
          if (byIndex.success) break;
          if (
            isReactSelectInput(targetElement) ||
            (targetElement.getAttribute?.("role") || "").toLowerCase() === "combobox"
          ) {
            const byReact = await selectFromReactSelect(targetElement, value, {
              selectedIndex: payload.selectedIndex,
            });
            if (byReact.success) break;
          }
        }
        const result = await selectByText(targetElement, value);
        if (!result.success) return result;
        break;
      }
      case "uploadFile": {
        const result = await performUpload(payload, targetElement, null);
        if (!result.success) return result;
        break;
      }
      default:
        return { success: false, error: `Unsupported action: ${action}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String((e && e.message) || e) };
  }
}
