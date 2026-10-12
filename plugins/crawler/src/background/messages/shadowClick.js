/* global chrome */

/**
 * Click exactly one Built In heart target in the page. Injectable as a MAIN-world
 * `func` — do not close over imports. `which` is heart | svg | host.
 * Pointer/mouse down-up, then one `element.click()`. Never a second click event.
 */
export function clickSaveInDocument(host, inner, root, which) {
  const kind = which || "heart";
  const doc = root?.querySelector ? root : typeof document !== "undefined" ? document : null;
  const hostEl = doc?.querySelector?.(host);
  if (!hostEl) return { found: false, clicked: false, which: kind };
  const heart = inner && hostEl.shadowRoot?.querySelector?.(inner);
  let node = heart;
  if (kind === "svg") {
    node = heart?.querySelector?.("svg") || heart?.querySelector?.("[data-prefix]") || null;
  } else if (kind === "host") {
    node = hostEl;
  }
  if (!node) return { found: true, clicked: false, which: kind };
  const types = ["pointerdown", "mousedown", "pointerup", "mouseup"];
  for (const type of types) {
    const usePointer = type.startsWith("pointer") && typeof PointerEvent === "function";
    const EventCtor = usePointer
      ? PointerEvent
      : typeof MouseEvent === "function"
        ? MouseEvent
        : Event;
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
      try {
        node.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      } catch {
        /* stand-in nodes in tests may not implement dispatchEvent */
      }
    }
  }
  try {
    node.click?.();
  } catch {
    return { found: true, clicked: false, which: kind };
  }
  return { found: true, clicked: true, which: kind };
}

/** Run one save click in the tab's MAIN world so the page hears it. */
export async function clickShadowInMainWorld(tabId, { host, inner, which } = {}) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    world: "MAIN",
    func: clickSaveInDocument,
    args: [host, inner, null, which],
  });
  return result ?? { found: false, clicked: false, which };
}
