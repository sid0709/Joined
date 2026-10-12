/* global chrome */

/**
 * Live signed-in save: one `div.heart.click()` in the page MAIN world.
 * Built In then POSTs userinteraction/set and the heart becomes `saved` / `fas`.
 */
export function clickSaveInDocument(host, inner, root = document) {
  const hostEl = root?.querySelector?.(host);
  if (!hostEl) return { found: false, clicked: false };
  const heart = inner && hostEl.shadowRoot?.querySelector?.(inner);
  if (!heart) return { found: true, clicked: false };
  if (typeof heart.click !== "function") return { found: true, clicked: false };
  try {
    heart.click();
  } catch {
    return { found: true, clicked: false };
  }
  return { found: true, clicked: true };
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
