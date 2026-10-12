import { ROUTINE_OP_ACTION } from "../../routineKit/protocol.js";
import { MARK_OVERLAY_WAIT_MS } from "../../routines/hiringcafe/constants.js";

const DEBUGGER_PROTOCOL_VERSION = "1.3";
const ALREADY_ATTACHED_RE = /already attached/i;

const defaultChromeDebugger = {
  attach: (target, version) => chrome.debugger.attach(target, version),
  detach: (target) => chrome.debugger.detach(target),
  sendCommand: (target, method, params) => chrome.debugger.sendCommand(target, method, params),
};

export function mouseEvent(type, point, extras = {}) {
  return {
    type,
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    ...extras,
  };
}

export function mouseMoved(point) {
  return mouseEvent("mouseMoved", point, { button: "none" });
}

export function mousePressed(point) {
  return mouseEvent("mousePressed", point, { button: "left", clickCount: 1 });
}

export function mouseReleased(point) {
  return mouseEvent("mouseReleased", point, { button: "left", clickCount: 1 });
}

function opResult(response) {
  return response?.result ?? response ?? {};
}

export async function attachDebugger(tabId, chromeDebugger = defaultChromeDebugger) {
  const target = { tabId };
  try {
    await chromeDebugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
  } catch (error) {
    if (!ALREADY_ATTACHED_RE.test(String(error?.message || error))) throw error;
  }
  return target;
}

export async function withDebugger(tabId, run, chromeDebugger = defaultChromeDebugger) {
  const target = await attachDebugger(tabId, chromeDebugger);
  try {
    return await run((method, params) => chromeDebugger.sendCommand(target, method, params));
  } finally {
    await chromeDebugger.detach(target).catch(() => {});
  }
}

async function hoverTargetOf(tabId, payload, sendToContentScript) {
  const response = await sendToContentScript(tabId, {
    action: ROUTINE_OP_ACTION,
    payload: {
      op: "hoverTarget",
      selector: payload.selector,
      nth: payload.nth,
      x: payload.x,
      y: payload.y,
      wait: payload.wait,
    },
  });
  return opResult(response);
}

async function overlayTargetOf(tabId, payload, sendToContentScript) {
  const response = await sendToContentScript(tabId, {
    action: ROUTINE_OP_ACTION,
    payload: {
      op: "overlayTarget",
      selector: payload.selector,
      clickSelector: payload.clickSelector,
      nth: payload.nth,
      contains: payload.contains,
      exact: payload.exact,
      wait: payload.overlayWait ?? payload.wait ?? MARK_OVERLAY_WAIT_MS,
    },
  });
  return opResult(response);
}

function hoverOffsets(payload) {
  if (Array.isArray(payload.offsets) && payload.offsets.length) return payload.offsets;
  return [{ x: payload.x ?? 100, y: payload.y ?? 100 }];
}

/**
 * Real pointer input: CDP `Input.dispatchMouseEvent` is trusted. Synthetic
 * mouseover/mouseenter is not, and HiringCafe's Mark Applied overlay needs
 * a trusted hover (React pointer events or CSS :hover).
 */
export async function dispatchTrustedMouse(tabId, payload, io = {}) {
  const sendToContentScript = io.sendToContentScript;
  const chromeDebugger = io.chromeDebugger ?? defaultChromeDebugger;
  const offsets = hoverOffsets(payload);
  return withDebugger(
    tabId,
    async (send) => {
      let hovered = false;
      for (const offset of offsets) {
        const target = await hoverTargetOf(tabId, { ...payload, ...offset }, sendToContentScript);
        if (!target?.found) continue;
        hovered = true;
        await send("Input.dispatchMouseEvent", mouseMoved(target));
        if (payload.op !== "hoverClick") return { found: true, hovered: true };
        const overlay = await overlayTargetOf(tabId, payload, sendToContentScript);
        if (!overlay?.found) continue;
        await send("Input.dispatchMouseEvent", mouseMoved(overlay));
        await send("Input.dispatchMouseEvent", mousePressed(overlay));
        await send("Input.dispatchMouseEvent", mouseReleased(overlay));
        return { found: true, hovered: true };
      }
      return { found: false, hovered };
    },
    chromeDebugger,
  );
}
