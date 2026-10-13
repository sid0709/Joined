import { fetchDetailPages } from "../../routineKit/detailTabs.js";

import { isHiringCafeChallenge } from "./challenge.js";
import { isJobDetailReady } from "./detailReady.js";

/** HiringCafe job pages in background tabs, read once `__NEXT_DATA__.job` and the h1 land. */
export function fetchHiringCafeDetails({ call, rest, skipDelays, checkStopped, jobs, onActivity }) {
  return fetchDetailPages({
    call,
    rest,
    skipDelays,
    checkStopped,
    jobs,
    isReady: isJobDetailReady,
    isChallenge: (page) => isHiringCafeChallenge(page),
    onActivity,
  });
}
