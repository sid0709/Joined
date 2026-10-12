import {
  clearHighlights,
  defineRoutine,
  highlight,
  listDetail,
  ON_MISSING,
  waitFor,
} from "../routineKit";

import {
  HIRINGCAFE_HOSTS,
  JOB_CARD,
  NEXT_DATA_SCRIPT,
  START_FROM_PAGE_ONE_LABEL,
  resumeLabelFromCursor,
} from "./hiringcafe/constants";
import { HIRINGCAFE_FIELDS, HIRINGCAFE_RUN_VIEW } from "./hiringcafe/fields";
import { runHiringCafePass } from "./hiringcafe/runPass";
import { createHiringCafeStore } from "./hiringcafe/store";
import { ROUTINE_OUTPUTS } from "./outputs";

/*
 * HiringCafe's classic board is server-rendered and paginated (`/classic?page=N`,
 * 0-indexed). Each pass opens the next unhandled ssrHits posting in the same tab
 * (cards group several requisition_ids; we enumerate every hit), reads
 * `__NEXT_DATA__.props.pageProps.job`, and enqueues it. Handled state is the
 * local requisition_id store. Mark Applied stays behind a flag. A 403 / 429
 * backs off without limit; a Turnstile challenge waits for the user.
 */

async function loadResumeLabel(store = createHiringCafeStore()) {
  return resumeLabelFromCursor(await store.loadCursor());
}

async function resetResumeCursor(store = createHiringCafeStore()) {
  await store.clearCursor();
}

export default defineRoutine({
  id: "hiringcafe",
  label: "HiringCafe",
  version: 1,
  match: { hosts: HIRINGCAFE_HOSTS },
  output: ROUTINE_OUTPUTS.JOB,
  declaredFields: HIRINGCAFE_FIELDS,
  runView: HIRINGCAFE_RUN_VIEW,
  options: { highlightFields: false, fieldPauseMs: 0, allowFetch: false },
  runPass: runHiringCafePass,
  resume: {
    resetLabel: START_FROM_PAGE_ONE_LABEL,
    loadLabel: loadResumeLabel,
    reset: resetResumeCursor,
  },

  strategy: listDetail({
    open: [
      clearHighlights(),
      highlight(JOB_CARD),
      waitFor(NEXT_DATA_SCRIPT, { onMissing: ON_MISSING.FINISH, label: "Waiting for job list" }),
    ],
    ready: [
      waitFor(NEXT_DATA_SCRIPT, {
        onMissing: ON_MISSING.SKIP,
        label: "Waiting for job posting data",
      }),
    ],
    dismiss: [],
    settle: [clearHighlights()],
  }),
});
