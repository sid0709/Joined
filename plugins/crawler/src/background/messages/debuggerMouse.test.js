import { beforeEach, describe, expect, test } from "bun:test";

import { ROUTINE_OP_ACTION } from "../../routineKit/protocol.js";

import {
  attachDebugger,
  dispatchTrustedMouse,
  emulateBackgroundFocus,
  ensureDebugger,
  hasDebuggerApi,
  mouseMoved,
  mousePressed,
  mouseReleased,
  releaseDebugger,
  resetDebuggerSession,
  toCdpPoint,
} from "./debuggerMouse.js";

function chromeDebugger() {
  const commands = [];
  return {
    commands,
    attach: async () => {
      commands.push("attach");
    },
    detach: async () => {
      commands.push("detach");
    },
    sendCommand: async (_target, method, params) => {
      commands.push({ method, params });
    },
  };
}

function tabsIo({ active = false } = {}) {
  const calls = [];
  return {
    calls,
    get: async (tabId) => {
      calls.push({ op: "get", tabId });
      return { id: tabId, active, windowId: 9 };
    },
    update: async (tabId, props) => {
      calls.push({ op: "update", tabId, props });
    },
    updateWindow: async (windowId, props) => {
      calls.push({ op: "updateWindow", windowId, props });
    },
  };
}

const APPROACH = [
  { x: 120, y: 32 },
  { x: 120, y: 59 },
  { x: 120, y: 86 },
  { x: 120, y: 113 },
  { x: 140, y: 160 },
];

const DIAG = {
  rect: { left: 20, top: 40, width: 320, height: 220 },
  viewport: { width: 800, height: 600 },
  scroll: { x: 0, y: 0 },
  dpr: 1,
  hit: { tag: "DIV", classes: "job-card" },
  overlay: false,
};

beforeEach(() => {
  resetDebuggerSession();
});

describe("debugger mouse events", () => {
  test("builds trusted CDP mouse payloads", () => {
    expect(mouseMoved({ x: 100, y: 120 })).toEqual({
      type: "mouseMoved",
      x: 100,
      y: 120,
      button: "none",
    });
    expect(mousePressed({ x: 10, y: 20 })).toEqual({
      type: "mousePressed",
      x: 10,
      y: 20,
      button: "left",
      clickCount: 1,
    });
    expect(mouseReleased({ x: 10, y: 20 })).toEqual({
      type: "mouseReleased",
      x: 10,
      y: 20,
      button: "left",
      clickCount: 1,
    });
  });

  test("reattaches when Chrome says the debugger is already attached", async () => {
    const calls = [];
    await attachDebugger(3, {
      attach: async () => {
        calls.push("attach");
        throw new Error("Another debugger is already attached to the tab");
      },
      sendCommand: async () => {},
    });
    expect(calls).toEqual(["attach"]);
    await expect(
      attachDebugger(3, {
        attach: async () => {
          throw new Error("denied");
        },
        sendCommand: async () => {},
      }),
    ).rejects.toThrow("denied");
  });

  test("treats a missing debugger API as optional", async () => {
    expect(hasDebuggerApi({})).toBe(false);
    expect(hasDebuggerApi({ attach: async () => {}, sendCommand: async () => {} })).toBe(true);
    await expect(attachDebugger(1, {})).rejects.toThrow("chrome.debugger is not available");
    expect(await releaseDebugger(99, chromeDebugger())).toEqual({ detached: true });
  });

  test("skips an offset whose hover target is not inside the card", async () => {
    const debug = chromeDebugger();
    const result = await dispatchTrustedMouse(
      4,
      { op: "hover", selector: ".card", offsets: [{ x: 100, y: 100 }] },
      {
        chromeDebugger: debug,
        tabs: tabsIo({ active: true }),
        sendToContentScript: async () => ({
          result: { found: false, diagnosticsText: "hit=BODY overlay=no" },
        }),
      },
    );
    expect(result).toMatchObject({ found: false, hovered: false, pressed: false });
    expect(result.diagnosticsText).toContain("hit=BODY");
    expect(debug.commands.filter((item) => item?.method)).toEqual([
      { method: "Emulation.setFocusEmulationEnabled", params: { enabled: true } },
      { method: "Page.getLayoutMetrics", params: undefined },
    ]);
    expect(debug.commands.some((item) => item?.method === "Input.dispatchMouseEvent")).toBe(false);
  });

  test("emulates focus on a background tab instead of activating it", async () => {
    const debug = chromeDebugger();
    expect(await emulateBackgroundFocus(7, debug)).toEqual({ emulated: true });
    expect(debug.commands).toEqual([
      { method: "Emulation.setFocusEmulationEnabled", params: { enabled: true } },
    ]);
    expect(await emulateBackgroundFocus(7, {})).toEqual({ emulated: false });
    expect(
      await emulateBackgroundFocus(7, {
        sendCommand: async () => {
          throw new Error("unsupported");
        },
      }),
    ).toEqual({ emulated: false });
  });

  test("moves along the approach path then clicks the overlay without detaching", async () => {
    const debug = chromeDebugger();
    const tabs = tabsIo({ active: false });
    const ops = [];
    const result = await dispatchTrustedMouse(
      7,
      {
        op: "hoverClick",
        selector: ".card",
        clickSelector: ".mark",
        contains: "Mark Applied",
        exact: true,
        offsets: [{ x: 100, y: 100 }],
        overlayWait: 400,
      },
      {
        chromeDebugger: debug,
        tabs,
        sendToContentScript: async (_tabId, message) => {
          ops.push(message.payload.op);
          if (message.action !== ROUTINE_OP_ACTION) return {};
          if (message.payload.op === "hoverTarget") {
            return {
              success: true,
              result: {
                found: true,
                x: 140,
                y: 160,
                approach: APPROACH,
                diagnostics: DIAG,
                diagnosticsText: "rect=20,40 320x220 overlay=no",
              },
            };
          }
          return { success: true, result: { found: true, x: 200, y: 80 } };
        },
      },
    );
    expect(result.found).toBe(true);
    expect(result.pressed).toBe(true);
    expect(ops).toEqual(["hoverTarget", "overlayTarget"]);
    expect(tabs.calls.some((call) => call.op === "update")).toBe(false);
    expect(debug.commands).toContainEqual({
      method: "Emulation.setFocusEmulationEnabled",
      params: { enabled: true },
    });
    const moves = debug.commands.filter(
      (item) => item?.method === "Input.dispatchMouseEvent" && item.params.type === "mouseMoved",
    );
    expect(moves.map((item) => item.params).slice(0, APPROACH.length)).toEqual(
      APPROACH.map((point) => mouseMoved(point)),
    );
    expect(debug.commands.some((item) => item === "detach")).toBe(false);
    expect(debug.commands.filter((item) => item === "attach")).toHaveLength(1);
  });

  test("returns pressed after a press even when the release command throws", async () => {
    const debug = chromeDebugger();
    debug.sendCommand = async (_target, method, params) => {
      debug.commands.push({ method, params });
      if (method === "Input.dispatchMouseEvent" && params.type === "mouseReleased") {
        throw new Error("tab closed during release");
      }
    };
    const result = await dispatchTrustedMouse(
      7,
      { op: "hoverClick", selector: ".card", offsets: [{ x: 100, y: 100 }] },
      {
        chromeDebugger: debug,
        tabs: tabsIo({ active: false }),
        sendToContentScript: async (_tabId, message) => {
          if (message.payload.op === "hoverTarget") {
            return { result: { found: true, x: 12, y: 18, approach: [{ x: 12, y: 18 }] } };
          }
          return { result: { found: true, x: 20, y: 30 } };
        },
      },
    );
    expect(result).toMatchObject({ found: true, hovered: true, pressed: true });
  });

  test("returns found once a press has been sent", async () => {
    const result = await dispatchTrustedMouse(
      7,
      { op: "hoverClick", selector: ".card", offsets: [{ x: 100, y: 100 }] },
      {
        chromeDebugger: chromeDebugger(),
        tabs: tabsIo({ active: true }),
        sendToContentScript: async (_tabId, message) => {
          if (message.payload.op === "hoverTarget") {
            return {
              result: {
                found: true,
                x: 12,
                y: 18,
                approach: [
                  { x: 1, y: 1 },
                  { x: 12, y: 18 },
                ],
              },
            };
          }
          return { result: { found: true, x: 20, y: 30 } };
        },
      },
    );
    expect(result).toMatchObject({ found: true, hovered: true, pressed: true });
  });

  test("returns hovered without a click when the overlay never appears", async () => {
    const result = await dispatchTrustedMouse(
      7,
      { op: "hoverClick", selector: ".card", offsets: [{ x: 100, y: 100 }] },
      {
        chromeDebugger: chromeDebugger(),
        tabs: tabsIo({ active: true }),
        sendToContentScript: async (_tabId, message) => {
          if (message.payload.op === "hoverTarget")
            return {
              result: {
                found: true,
                x: 12,
                y: 18,
                diagnostics: DIAG,
                diagnosticsText: "overlay=no",
              },
            };
          return { result: { found: false } };
        },
      },
    );
    expect(result.found).toBe(false);
    expect(result.hovered).toBe(true);
    expect(result.pressed).toBe(false);
    expect(result.diagnosticsText).toContain("overlay=no");
  });

  test("keeps CSS-pixel CDP coords at 90%, 100%, and 110% zoom and with the side panel", async () => {
    const point = { x: 100, y: 200 };
    expect(toCdpPoint(point)).toEqual(point);
    for (const scale of [0.9, 1, 1.1]) {
      expect(
        toCdpPoint(point, {
          cssVisualViewport: {
            scale,
            clientWidth: 1280 / scale,
            offsetX: 0,
            offsetY: 0,
            pageX: 0,
            pageY: 0,
          },
          cssLayoutViewport: { clientWidth: 1280 / scale, pageX: 0, pageY: 0 },
        }),
      ).toEqual(point);
    }
    expect(
      toCdpPoint(point, {
        cssVisualViewport: {
          scale: 1,
          clientWidth: 980,
          offsetX: 0,
          offsetY: 0,
          pageX: 0,
          pageY: 0,
        },
        cssLayoutViewport: { clientWidth: 980, pageX: 0, pageY: 0 },
      }),
    ).toEqual(point);
    expect(
      toCdpPoint(point, {
        cssVisualViewport: { offsetX: 12, offsetY: 8, pageX: 40, pageY: 10 },
        cssLayoutViewport: { pageX: 40, pageY: 0 },
      }),
    ).toEqual({ x: 88, y: 182 });
    const debug = chromeDebugger();
    debug.sendCommand = async (_target, method, params) => {
      debug.commands.push({ method, params });
      if (method === "Page.getLayoutMetrics") {
        return {
          cssVisualViewport: {
            scale: 0.9,
            clientWidth: 1422,
            offsetX: 0,
            offsetY: 0,
            pageX: 0,
            pageY: 0,
          },
          cssLayoutViewport: { clientWidth: 1422, pageX: 0, pageY: 0 },
        };
      }
    };
    await dispatchTrustedMouse(
      2,
      { op: "hover", selector: ".card", x: 100, y: 100 },
      {
        chromeDebugger: debug,
        tabs: tabsIo({ active: false }),
        sendToContentScript: async () => ({
          result: { found: true, x: 100, y: 200, approach: [{ x: 100, y: 200 }] },
        }),
      },
    );
    expect(debug.commands.filter((item) => item?.method === "Input.dispatchMouseEvent")).toEqual([
      { method: "Input.dispatchMouseEvent", params: mouseMoved({ x: 100, y: 200 }) },
    ]);
  });

  test("marks a press throw so routine exec does not fall back to synthetic hover", async () => {
    const debug = chromeDebugger();
    debug.sendCommand = async (_target, method, params) => {
      debug.commands.push({ method, params });
      if (method === "Input.dispatchMouseEvent" && params.type === "mousePressed") {
        throw new Error("press failed");
      }
    };
    await expect(
      dispatchTrustedMouse(
        7,
        { op: "hoverClick", selector: ".card", offsets: [{ x: 100, y: 100 }] },
        {
          chromeDebugger: debug,
          tabs: tabsIo({ active: false }),
          sendToContentScript: async (_tabId, message) => {
            if (message.payload.op === "hoverTarget") {
              return { result: { found: true, x: 12, y: 18, approach: [{ x: 12, y: 18 }] } };
            }
            return { result: { found: true, x: 20, y: 30 } };
          },
        },
      ),
    ).rejects.toMatchObject({ message: "press failed", pressed: true });
  });

  test("hover-only sends the approach mouseMoved sequence and keeps the session", async () => {
    const debug = chromeDebugger();
    const result = await dispatchTrustedMouse(
      2,
      { op: "hover", selector: ".card", x: 100, y: 100 },
      {
        chromeDebugger: debug,
        tabs: tabsIo({ active: true }),
        sendToContentScript: async () => ({
          result: {
            found: true,
            x: 50,
            y: 60,
            approach: [
              { x: 10, y: 10 },
              { x: 50, y: 60 },
            ],
          },
        }),
      },
    );
    expect(result).toMatchObject({ found: true, hovered: true, pressed: false });
    expect(debug.commands.filter((item) => item === "detach")).toEqual([]);
    expect(debug.commands.filter((item) => item?.method === "Input.dispatchMouseEvent")).toEqual([
      { method: "Input.dispatchMouseEvent", params: mouseMoved({ x: 10, y: 10 }) },
      { method: "Input.dispatchMouseEvent", params: mouseMoved({ x: 50, y: 60 }) },
    ]);
  });

  test("uses the default chrome wrappers when io omits them", async () => {
    const calls = [];
    globalThis.chrome = {
      debugger: {
        attach: async (...args) => {
          calls.push(["attach", args[0]]);
        },
        detach: async (...args) => {
          calls.push(["detach", args[0]]);
        },
        sendCommand: async (...args) => {
          calls.push(["send", args[1]]);
        },
      },
      tabs: {
        get: async (tabId) => {
          calls.push(["get", tabId]);
          return { id: tabId, active: false, windowId: 2 };
        },
        update: async (tabId, props) => {
          calls.push(["update", tabId, props]);
        },
      },
      windows: {
        update: async (windowId, props) => {
          calls.push(["window", windowId, props]);
        },
      },
    };
    try {
      await attachDebugger(8);
      await dispatchTrustedMouse(
        8,
        { op: "hover", selector: ".card" },
        {
          sendToContentScript: async () => ({ result: { found: true, x: 1, y: 2 } }),
        },
      );
      await releaseDebugger(8);
    } finally {
      delete globalThis.chrome;
    }
    expect(calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(["attach", "detach", "send"]),
    );
    expect(calls.map((call) => call[0])).not.toEqual(expect.arrayContaining(["update", "window"]));
  });

  test("attaches once and reuses the session on the next job", async () => {
    const debug = chromeDebugger();
    const io = {
      chromeDebugger: debug,
      tabs: tabsIo({ active: true }),
      sendToContentScript: async () => ({ result: { found: true, x: 50, y: 60 } }),
    };
    await dispatchTrustedMouse(2, { op: "hover", selector: ".card" }, io);
    await dispatchTrustedMouse(2, { op: "hover", selector: ".card" }, io);
    expect(debug.commands.filter((item) => item === "attach")).toHaveLength(1);
    expect(debug.commands.filter((item) => item === "detach")).toHaveLength(0);
    const reused = await ensureDebugger(2, debug);
    expect(reused).toEqual({ attached: true, reused: true });
    expect(await releaseDebugger(2, debug)).toEqual({ detached: true });
    expect(debug.commands.filter((item) => item === "detach")).toHaveLength(1);
  });
});
