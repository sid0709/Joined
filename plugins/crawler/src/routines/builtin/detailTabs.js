import { fetchDetailPages } from "../../routineKit/detailTabs.js";

import { JSON_LD_SCRIPT, TITLE_HEADING } from "./constants.js";
import { isJobDetailReady } from "./detailReady.js";

/** Built In job pages in background tabs: ready once the h1, JSON-LD, and jobPostInit land. */
export function fetchBuiltInDetails({ call, jobs, onActivity }) {
  return fetchDetailPages({
    call,
    jobs,
    readySelectors: [TITLE_HEADING, JSON_LD_SCRIPT],
    isReady: isJobDetailReady,
    onActivity,
  });
}
