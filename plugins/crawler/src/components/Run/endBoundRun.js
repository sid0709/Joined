import { ROUTINE_UNBIND_TAB_ACTION } from "../../routineKit/protocol";

/**
 * Finish, block, stop, and tab-close all go through here so the debugger
 * session (Chrome's "debugging this browser" bar) is released with the bind.
 */
export async function endBoundRun(tabId, io = {}) {
  if (!Number.isFinite(tabId)) return { detached: false, unbound: false };
  await io.execRoutineOp?.(tabId, { op: "detachDebugger" })?.catch?.(() => {});
  await io
    .sendRuntimeMessage?.({
      action: ROUTINE_UNBIND_TAB_ACTION,
      tabId,
      payload: { tabId },
    })
    ?.catch?.(() => {});
  return { detached: true, unbound: true };
}
