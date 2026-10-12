import {
  clearHighlights,
  defineRoutine,
  highlight,
  listDetail,
  ON_MISSING,
  waitFor,
} from "../routineKit";

import { BUILTIN_HOSTS, JOB_CARD, JSON_LD_SCRIPT, NEXT_PAGE } from "./builtin/constants";
import { BUILTIN_FIELDS, BUILTIN_RUN_VIEW } from "./builtin/fields";
import { runBuiltInPass } from "./builtin/runPass";
import { ROUTINE_OUTPUTS } from "./outputs";

/*
 * Built In's job board is server-rendered and paginated. Each pass opens the next
 * unhandled card's job page in the same tab (the title link is target=_blank, so
 * we never click it), reads JSON-LD + Builtin.jobPostInit({...}) from the visible
 * page, enqueues the job, then returns to ?page=N and clicks that card's list
 * heart (one MAIN-world div.heart.click()). Already-saved hearts, or a card
 * with no my-item and a visible Saved badge, are skipped. A hidden Saved span
 * is not a skip. Missing my-item without a visible badge still opens and
 * enqueues; only the heart click is skipped. A signed-out session
 * (isLoggedIn false or a visible save-wall modal) stops before hearting. A
 * 403, 429, challenge, or login wall backs off and resumes; a timeout is
 * retried.
 */

export default defineRoutine({
  id: "builtin",
  label: "Built In",
  version: 3,
  match: { hosts: BUILTIN_HOSTS },
  output: ROUTINE_OUTPUTS.JOB,
  declaredFields: BUILTIN_FIELDS,
  runView: BUILTIN_RUN_VIEW,
  options: { highlightFields: false, fieldPauseMs: 0, allowFetch: false },
  runPass: runBuiltInPass,

  strategy: listDetail({
    open: [
      clearHighlights(),
      highlight(JOB_CARD),
      waitFor(JOB_CARD, { onMissing: ON_MISSING.FINISH, label: "Waiting for job cards" }),
    ],
    ready: [
      waitFor(JSON_LD_SCRIPT, {
        onMissing: ON_MISSING.SKIP,
        label: "Waiting for job posting data",
      }),
    ],
    dismiss: [
      waitFor(NEXT_PAGE, { onMissing: ON_MISSING.SKIP, label: "Checking for another page" }),
    ],
    settle: [clearHighlights()],
  }),
});
