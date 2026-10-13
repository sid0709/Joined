import { describe, expect, test } from "bun:test";

import { ROUTINE_UNBIND_TAB_ACTION } from "../../routineKit/protocol";

import { endBoundRun } from "./endBoundRun.js";

describe("endBoundRun", () => {
  test("detaches the debugger then unbinds on finish, block, stop, or tab close", async () => {
    const ops = [];
    const sent = [];
    await expect(
      endBoundRun(21, {
        execRoutineOp: async (tabId, payload) => {
          ops.push({ tabId, payload });
          return { detached: true };
        },
        sendRuntimeMessage: async (message) => {
          sent.push(message);
          return { success: true };
        },
      }),
    ).resolves.toEqual({ detached: true, unbound: true });
    expect(ops).toEqual([{ tabId: 21, payload: { op: "detachDebugger" } }]);
    expect(sent).toEqual([
      { action: ROUTINE_UNBIND_TAB_ACTION, tabId: 21, payload: { tabId: 21 } },
    ]);
  });

  test("still unbinds when detach rejects", async () => {
    const sent = [];
    await expect(
      endBoundRun(8, {
        execRoutineOp: async () => {
          throw new Error("already detached");
        },
        sendRuntimeMessage: async (message) => {
          sent.push(message.action);
        },
      }),
    ).resolves.toEqual({ detached: true, unbound: true });
    expect(sent).toEqual([ROUTINE_UNBIND_TAB_ACTION]);
  });

  test("still reports unbound when unbind rejects", async () => {
    await expect(
      endBoundRun(8, {
        execRoutineOp: async () => ({ detached: true }),
        sendRuntimeMessage: async () => {
          throw new Error("no receiver");
        },
      }),
    ).resolves.toEqual({ detached: true, unbound: true });
  });

  test("skips a missing tabId", async () => {
    let called = false;
    await expect(
      endBoundRun(undefined, {
        execRoutineOp: async () => {
          called = true;
        },
      }),
    ).resolves.toEqual({ detached: false, unbound: false });
    expect(called).toBe(false);
  });
});
