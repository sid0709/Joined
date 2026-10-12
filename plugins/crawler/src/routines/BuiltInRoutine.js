import {
  click,
  defineRoutine,
  listDetail,
  ON_MISSING,
  pairs,
  pause,
  prop,
  text,
  waitFor,
} from "../routineKit";

import {
  BUILTIN_HOSTS,
  HEADER_SCOPE,
  JOB_CARD,
  JOB_DELAY_MS,
  JSON_LD_SCRIPT,
  NEXT_PAGE,
  PAGE_DELAY_MS,
} from "./builtin/constants";
import { runBuiltInPass } from "./builtin/runPass";
import { ROUTINE_OUTPUTS } from "./outputs";

/*
 * Built In's job board is server-rendered and paginated. Each pass fetches the
 * next unhandled job's HTML (same-origin, so a signed-in session keeps applyUrl),
 * reads the JSON-LD JobPosting plus Builtin.jobPostInit, and enqueues it. Skip
 * state is a local handled-ID store; Save is optional and does not remove cards.
 */

const JOB_TITLE = "h1 span";
const COMPANY_HEADING = `${HEADER_SCOPE} h2`;
const COMPANY_LOGO = `${HEADER_SCOPE} picture img`;
const COMPANY_LINK = `${HEADER_SCOPE} a[href^="/company/"]`;
const POSTED = `${HEADER_SCOPE} .fa-clock + span`;
const JOB_BODY = '[id^="job-post-body-"]';
const SAVE_CONTROL = 'my-item[entity-type="job"]';

export default defineRoutine({
  id: "builtin",
  label: "Built In",
  version: 1,
  match: { hosts: BUILTIN_HOSTS },
  output: ROUTINE_OUTPUTS.JOB,
  options: { highlightFields: false, fieldPauseMs: 0 },
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

  fields: {
    "company.logo": prop(COMPANY_LOGO, "src", { label: "Logo" }),
    applyLink: prop("link[rel=canonical]", "href", { then: ["httpUrl"], label: "Apply link" }),
    tags: text(`${HEADER_SCOPE} .fw-semibold`, { all: true, label: "Job tags" }),
    "company.name": text(COMPANY_HEADING, { label: "Company" }),
    postedAgo: text(POSTED, { label: "Posted" }),
    title: text(JOB_TITLE, { label: "Job title" }),
    details: pairs(`${HEADER_SCOPE} .d-flex.align-items-start.gap-sm`, {
      key: ["i", "attr:class"],
      value: ["span", "text"],
      label: "Job details",
    }),
    description: text(JOB_BODY),
    "company.tags": text(`${HEADER_SCOPE} ~ * .font-barlow.fw-medium`, {
      then: ["lines"],
      label: "Company tags",
    }),
    skills: text("h2", { inner: "li", all: true }),
    companyLink: prop(COMPANY_LINK, "href", { then: ["httpUrl"], label: "Website" }),
  },
});
