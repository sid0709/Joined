import {
  clearHighlights,
  click,
  defineRoutine,
  highlight,
  listDetail,
  ON_MISSING,
  pause,
  waitFor,
  waitGone,
} from "../routineKit";

import {
  CLOSE_DETAIL_BUTTON,
  DETAIL_PANE,
  JOB_CARD,
  JOB_LINK,
  JOBRIGHT_HOSTS,
  NOT_INTERESTED_BUTTON,
  NOT_INTERESTED_CONFIRM,
} from "./jobright/constants";
import { JOBRIGHT_FIELDS, JOBRIGHT_RUN_VIEW } from "./jobright/fields";
import { readJobRightRecord } from "./jobright/readRecord";
import { ROUTINE_OUTPUTS } from "./outputs";

/*
 * JobRight's job list: each pass opens the first job card, reads `#__NEXT_DATA__`
 * (fetching `/jobs/info/:id` when the overlay has no JSON), marks the job
 * "Not interested" (which removes the card), and closes the pane. Class names
 * are CSS-module hashes, so selectors match on a stable prefix, id, or aria-label.
 */

export default defineRoutine({
  id: "jobright",
  label: "JobRight",
  version: 2,
  match: { hosts: JOBRIGHT_HOSTS },
  output: ROUTINE_OUTPUTS.JOB,
  declaredFields: JOBRIGHT_FIELDS,
  runView: JOBRIGHT_RUN_VIEW,
  options: { highlightFields: false, fieldPauseMs: 0, allowFetch: true },
  readRecord: readJobRightRecord,

  strategy: listDetail({
    open: [
      clearHighlights(),
      highlight(JOB_CARD),
      click(JOB_LINK, {
        highlight: false,
        onMissing: ON_MISSING.FINISH,
        label: "Opening next job",
      }),
      pause(250),
      clearHighlights(),
    ],
    ready: [
      waitFor(DETAIL_PANE, { onMissing: ON_MISSING.SKIP, label: "Waiting for job details" }),
      pause(250),
    ],
    dismiss: [
      click(NOT_INTERESTED_BUTTON, { onMissing: ON_MISSING.SKIP, label: "Marking not interested" }),
      pause(250),
      click(NOT_INTERESTED_CONFIRM, { onMissing: ON_MISSING.SKIP, label: "Confirming" }),
      pause(250),
      click(CLOSE_DETAIL_BUTTON, { onMissing: ON_MISSING.SKIP, label: "Closing job details" }),
      pause(250),
      waitGone(DETAIL_PANE, {
        timeout: 8000,
        interval: 400,
        notice: "Closing job detail",
        label: "Waiting for details to close",
      }),
    ],
    settle: [clearHighlights(), pause(250)],
  }),
});
