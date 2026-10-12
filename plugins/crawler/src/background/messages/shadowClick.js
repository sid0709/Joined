/* global chrome */

/**
 * A real pointer/mouse sequence that crosses an open shadow root (`composed`)
 * and runs in the page's main world, where Built In's save listener lives.
 */
export function dispatchRealClick(node) {
  if (!node) return;
  const types = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
  for (const type of types) {
    const usePointer = type.startsWith("pointer") && typeof PointerEvent === "function";
    const EventCtor = usePointer ? PointerEvent : MouseEvent;
    try {
      node.dispatchEvent(
        new EventCtor(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: typeof window !== "undefined" ? window : undefined,
        }),
      );
    } catch {
      node.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    }
  }
  try {
    node.click?.();
  } catch {
    // Best-effort only; the dispatched sequence is the click Built In hears.
  }
}

/** Click `div.heart`, its svg, then the `my-item` host. */
export function clickSaveInDocument(host, inner, root = document) {
  const hostEl = root?.querySelector?.(host);
  if (!hostEl) return { found: false, clicked: false };
  const shadow = hostEl.shadowRoot;
  const heart = inner && shadow?.querySelector ? shadow.querySelector(inner) : null;
  const svg = heart?.querySelector?.("svg") || heart?.querySelector?.("[data-prefix]") || null;
  const targets = [heart, svg, hostEl].filter(Boolean);
  for (const node of targets) dispatchRealClick(node);
  return { found: Boolean(heart || hostEl), clicked: targets.length > 0 };
}

/** Run the save click in the tab's MAIN world so the page hears it. */
export async function clickShadowInMainWorld(tabId, { host, inner } = {}) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    world: "MAIN",
    func: clickSaveInDocument,
    args: [host, inner],
  });
  return result ?? { found: false, clicked: false };
}
