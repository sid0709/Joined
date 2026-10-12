import { describe, expect, test } from "bun:test";

import { ROUTINE_OP_ACTION } from "../../routineKit/protocol.js";

import {
  attachDebugger,
  dispatchTrustedMouse,
  mouseMoved,
  mousePressed,
  mouseReleased,
} from "./debuggerMouse.js";

function chromeDebugger() {
  const commands = [];
  return {
    commands,
    attach: async () => {},
    detach: async () => {
      commands.push("detach");
    },
    sendCommand: async (_target, method, params) => {
      commands.push({ method, params });
    },
  };
}

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
    });
    expect(calls).toEqual(["attach"]);
    await expect(
      attachDebugger(3, {
        attach: async () => {
          throw new Error("denied");
        },
      }),
    ).rejects.toThrow("denied");
  });

  test("hovers with mouseMoved then clicks the overlay", async () => {
    const debug = chromeDebugger();
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
        overlayWait: 2000,
      },
      {
        chromeDebugger: debug,
        sendToContentScript: async (_tabId, message) => {
          ops.push(message.payload.op);
          if (message.action !== ROUTINE_OP_ACTION) return {};
          if (message.payload.op === "hoverTarget")
            return { success: true, result: { found: true, x: 140, y: 160 } };
          return { success: true, result: { found: true, x: 200, y: 80 } };
        },
      },
    );
    expect(result).toEqual({ found: true, hovered: true });
    expect(ops).toEqual(["hoverTarget", "overlayTarget"]);
    expect(debug.commands[0]).toEqual({
      method: "Input.dispatchMouseEvent",
      params: mouseMoved({ x: 140, y: 160 }),
    });
    expect(debug.commands[1]).toEqual({
      method: "Input.dispatchMouseEvent",
      params: mouseMoved({ x: 200, y: 80 }),
    });
    expect(debug.commands[2].params.type).toBe("mousePressed");
    expect(debug.commands[3].params.type).toBe("mouseReleased");
    expect(debug.commands.at(-1)).toBe("detach");
  });

  test("returns hovered without a click when the overlay never appears", async () => {
    const result = await dispatchTrustedMouse(
      7,
      { op: "hoverClick", selector: ".card", offsets: [{ x: 100, y: 100 }] },
      {
        chromeDebugger: chromeDebugger(),
        sendToContentScript: async (_tabId, message) => {
          if (message.payload.op === "hoverTarget")
            return { result: { found: true, x: 12, y: 18 } };
          return { result: { found: false } };
        },
      },
    );
    expect(result).toEqual({ found: false, hovered: true });
  });

  test("hover-only sends mouseMoved and no click", async () => {
    const debug = chromeDebugger();
    const result = await dispatchTrustedMouse(
      2,
      { op: "hover", selector: ".card", x: 100, y: 100 },
      {
        chromeDebugger: debug,
        sendToContentScript: async () => ({ result: { found: true, x: 50, y: 60 } }),
      },
    );
    expect(result).toEqual({ found: true, hovered: true });
    expect(debug.commands.filter((item) => item !== "detach")).toEqual([
      { method: "Input.dispatchMouseEvent", params: mouseMoved({ x: 50, y: 60 }) },
    ]);
  });
});
