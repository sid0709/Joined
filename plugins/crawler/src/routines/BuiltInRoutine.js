import { click, defineRoutine, listDetail, ON_MISSING, pause, waitFor } from "../routineKit";

import {
  BUILTIN_HOSTS,
  JOB_CARD,
  JOB_DELAY_MS,
  JSON_LD_SCRIPT,
  NEXT_PAGE,
  PAGE_DELAY_MS,
} from "./builtin/constants";
import { BUILTIN_FIELDS, BUILTIN_RUN_VIEW } from "./builtin/fields";
import { runBuiltInPass } from "./builtin/runPass";
import { ROUTINE_OUTPUTS } from "./outputs";

/*
 * Built In's job board is server-rendered and paginated. Each pass fetches the
 * next unhandled job's HTML (same-origin, so a signed-in session keeps applyUrl),
 * reads the JSON-LD JobPosting plus Builtin.jobPostInit, and enqueues it. Skip
 * state is a local handled-ID store; Save is optional and does not remove cards.
 * Signed-in applyUrl is often a relative `?handler=ApplyRedirect` path; we resolve
 * it to an absolute builtin.com URL and do not follow the redirect.
 */

const SAVE_CONTROL = 'my-item[entity-type="job"]';

export default defineRoutine({
  id: "builtin",
  label: "Built In",
  version: 2,
  match: { hosts: BUILTIN_HOSTS },
  output: ROUTINE_OUTPUTS.JOB,
  declaredFields: BUILTIN_FIELDS,
  runView: BUILTIN_RUN_VIEW,
  options: { highlightFields: false, fieldPauseMs: 0, allowFetch: true },
  runPass: runBuiltInPass,

  strategy: listDetail({
    open: [waitFor(JOB_CARD, { onMissing: ON_MISSING.FINISH, label: "Waiting for job cards" })],
    ready: [
      waitFor(JSON_LD_SCRIPT, {
        onMissing: ON_MISSING.SKIP,
        label: "Waiting for job posting data",
      }),
    ],
    dismiss: [
      click(SAVE_CONTROL, {
        highlight: false,
        onMissing: ON_MISSING.SKIP,
        label: "Saving job on Built In",
      }),
    ],
    settle: [
      pause(JOB_DELAY_MS.min),
      waitFor(NEXT_PAGE, { onMissing: ON_MISSING.SKIP, label: "Checking for another page" }),
      pause(PAGE_DELAY_MS.min),
    ],
  }),
});
