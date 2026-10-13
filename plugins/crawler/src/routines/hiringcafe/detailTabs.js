import { fetchDetailPages } from "../../routineKit/detailTabs.js";

import {
  CHALLENGE_TITLE_RE,
  NEXT_DATA_SCRIPT,
  TITLE_HEADING,
  TURNSTILE_WIDGET,
} from "./constants.js";
import { isJobDetailReady } from "./detailReady.js";

/** HiringCafe job pages in background tabs: ready once `__NEXT_DATA__` and the h1 land. */
export function fetchHiringCafeDetails({ call, jobs, onActivity }) {
  return fetchDetailPages({
    call,
    jobs,
    readySelectors: [NEXT_DATA_SCRIPT, TITLE_HEADING],
    challengeTitle: CHALLENGE_TITLE_RE.source,
    challengeSelector: TURNSTILE_WIDGET,
    isReady: isJobDetailReady,
    onActivity,
  });
}
