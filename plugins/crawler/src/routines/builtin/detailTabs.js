import { fetchDetailPages } from "../../routineKit/detailTabs.js";

import { isJobDetailReady } from "./detailReady.js";

/** Built In job pages in background tabs, read once jobPostInit, JSON-LD, and the h1 land. */
export function fetchBuiltInDetails({ call, rest, skipDelays, checkStopped, jobs, onActivity }) {
  return fetchDetailPages({
    call,
    rest,
    skipDelays,
    checkStopped,
    jobs,
    isReady: isJobDetailReady,
    onActivity,
  });
}
