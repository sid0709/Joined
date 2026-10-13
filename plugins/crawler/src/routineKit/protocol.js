/** Side panel → background: run one routine op in the target tab and answer with its result. */
export const ROUTINE_EXEC_ACTION = "routine:exec";

/** Background → content script: the routine op itself. */
export const ROUTINE_OP_ACTION = "routine:op";

/** `navigate` payload `until`: resolve at DOMContentLoaded instead of tab `complete`. */
export const NAVIGATE_UNTIL_DOM_READY = "domContentLoaded";

/** Side panel → background: bind this run to an exact tabId/windowId. */
export const ROUTINE_BIND_TAB_ACTION = "routine:bindTab";

/** Side panel → background: drop the bind when the run ends. */
export const ROUTINE_UNBIND_TAB_ACTION = "routine:unbindTab";

/** Background → side panel: the bound crawl tab was closed. */
export const ROUTINE_TAB_CLOSED_ACTION = "routine:tabClosed";

export const BOUND_TAB_CLOSED_MESSAGE = "The crawl tab was closed. The run stopped.";
export const BOUND_TAB_MISSING_MESSAGE = "No bound crawl tab. Start the run from the page tab.";

const RUN_GONE_RE =
  /no bound crawl tab|the crawl tab was closed|receiving end does not exist|no tab with id|the tab was closed/i;

export function isBoundTabClosedError(error) {
  const message = String(error?.message || error || "");
  return (
    error?.closed === true ||
    message === BOUND_TAB_CLOSED_MESSAGE ||
    message === BOUND_TAB_MISSING_MESSAGE ||
    RUN_GONE_RE.test(message)
  );
}
