import { formatHoverDiagnostics } from "../../contentScript/actions/hoverTarget.js";
import { ROUTINE_OP_ACTION } from "../../routineKit/protocol.js";
import { MARK_OVERLAY_WAIT_MS } from "../../routines/hiringcafe/constants.js";

const DEBUGGER_PROTOCOL_VERSION = "1.3";
const ALREADY_ATTACHED_RE = /already attached/i;

const attachedTabs = new Set();

const defaultChromeDebugger = {
  attach: (target, version) => chrome.debugger?.attach?.(target, version),
  detach: (target) => chrome.debugger?.detach?.(target),
  sendCommand: (target, method, params) => chrome.debugger?.sendCommand?.(target, method, params),
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

export function resetDebuggerSession() {
  attachedTabs.clear();
}

/** Debugger stays a required permission for live Mark Applied; this skip is for tests and missing APIs. */
export function hasDebuggerApi(chromeDebugger = defaultChromeDebugger) {
  return (
    typeof chromeDebugger?.attach === "function" &&
    typeof chromeDebugger?.sendCommand === "function"
  );
}

export async function attachDebugger(tabId, chromeDebugger = defaultChromeDebugger) {
  if (!hasDebuggerApi(chromeDebugger)) {
    throw new Error("chrome.debugger is not available");
  }
  const target = { tabId };
  try {
    await chromeDebugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
  } catch (error) {
    if (!ALREADY_ATTACHED_RE.test(String(error?.message || error))) throw error;
  }
  attachedTabs.add(tabId);
  return target;
}

export async function ensureDebugger(tabId, chromeDebugger = defaultChromeDebugger) {
  if (attachedTabs.has(tabId)) return { attached: true, reused: true };
  await attachDebugger(tabId, chromeDebugger);
  return { attached: true, reused: false };
}

export async function releaseDebugger(tabId, chromeDebugger = defaultChromeDebugger) {
  attachedTabs.delete(tabId);
  if (typeof chromeDebugger?.detach !== "function") return { detached: false };
  await chromeDebugger.detach({ tabId }).catch(() => {});
  return { detached: true };
}

export function layoutZoomOf(metrics, fallback = 1) {
  const visual = metrics?.cssVisualViewport;
  const layout = metrics?.cssLayoutViewport;
  const scale = Number(visual?.scale);
  if (Number.isFinite(scale) && scale > 0 && Math.abs(scale - 1) > 0.01) return scale;
  const visualWidth = Number(visual?.clientWidth);
  const layoutWidth = Number(layout?.clientWidth);
  if (visualWidth > 0 && layoutWidth > 0 && Math.abs(visualWidth / layoutWidth - 1) > 0.01) {
    return visualWidth / layoutWidth;
  }
  const fallbackZoom = Number(fallback);
  return Number.isFinite(fallbackZoom) && fallbackZoom > 0 ? fallbackZoom : 1;
}

export function toCdpPoint(point, zoom = 1) {
  const factor = Number(zoom);
  const scale = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return {
    x: (Number(point?.x) || 0) * scale,
    y: (Number(point?.y) || 0) * scale,
  };
}

async function pageLayoutZoom(send, fallback = 1) {
  try {
    const metrics = await send("Page.getLayoutMetrics");
    return { zoom: layoutZoomOf(metrics, fallback), metrics };
  } catch {
    return { zoom: fallback, metrics: null };
  }
}

export async function emulateBackgroundFocus(tabId, chromeDebugger) {
  if (typeof chromeDebugger?.sendCommand !== "function") return { emulated: false };
  try {
    await chromeDebugger.sendCommand({ tabId }, "Emulation.setFocusEmulationEnabled", {
      enabled: true,
    });
    return { emulated: true };
  } catch {
    return { emulated: false };
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

async function moveAlong(send, points) {
  for (const point of points) {
    await send("Input.dispatchMouseEvent", mouseMoved(point));
  }
}

/**
 * Real pointer input: CDP `Input.dispatchMouseEvent` is trusted. Synthetic
 * mouseover/mouseenter is not. Attach once per run; move from outside the
 * card into it so pointerenter fires.
 */
export async function dispatchTrustedMouse(tabId, payload, io = {}) {
  const sendToContentScript = io.sendToContentScript;
  const chromeDebugger = io.chromeDebugger ?? defaultChromeDebugger;
  await ensureDebugger(tabId, chromeDebugger);
  await emulateBackgroundFocus(tabId, chromeDebugger);
  const target = { tabId };
  const send = (method, params) => chromeDebugger.sendCommand(target, method, params);
  const offsets = hoverOffsets(payload);
  let hovered = false;
  let pressed = false;
  let diagnosticsText = "";
  let diagnostics = null;
  const layout = await pageLayoutZoom(send, 1);
  for (const offset of offsets) {
    const hover = await hoverTargetOf(tabId, { ...payload, ...offset }, sendToContentScript);
    diagnosticsText = hover?.diagnosticsText || diagnosticsText;
    diagnostics = hover?.diagnostics || diagnostics;
    const zoom = layoutZoomOf(layout.metrics, hover?.diagnostics?.zoom || layout.zoom);
    if (!hover?.found) continue;
    hovered = true;
    const path = Array.isArray(hover.approach) && hover.approach.length ? hover.approach : [hover];
    await moveAlong(
      send,
      path.map((point) => toCdpPoint(point, zoom)),
    );
    if (payload.op !== "hoverClick") {
      return { found: true, hovered: true, pressed: false, diagnostics, diagnosticsText };
    }
    const overlay = await overlayTargetOf(tabId, payload, sendToContentScript);
    diagnostics = {
      ...(hover.diagnostics || diagnostics || {}),
      overlay: Boolean(overlay?.found),
      candidates: overlay?.candidates || hover.diagnostics?.candidates || [],
      zoom,
    };
    diagnosticsText = formatHoverDiagnostics(diagnostics);
    if (!overlay?.found) continue;
    const clickAt = toCdpPoint(overlay, zoom);
    await send("Input.dispatchMouseEvent", mouseMoved(clickAt));
    await send("Input.dispatchMouseEvent", mousePressed(clickAt));
    pressed = true;
    try {
      await send("Input.dispatchMouseEvent", mouseReleased(clickAt));
    } catch {
      return { found: true, hovered: true, pressed: true, diagnostics, diagnosticsText };
    }
    return {
      found: true,
      hovered: true,
      pressed: true,
      diagnostics: { ...diagnostics, overlay: true },
      diagnosticsText,
    };
  }
  if (pressed) return { found: true, hovered: true, pressed: true, diagnostics, diagnosticsText };
  return { found: false, hovered, pressed: false, diagnostics, diagnosticsText };
}
