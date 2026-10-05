import {
  clearHighlights,
  click,
  defineRoutine,
  highlight,
  listDetail,
  ON_MISSING,
  pairs,
  pause,
  prop,
  text,
  waitFor,
  waitGone,
} from "../routineKit";

import { ROUTINE_OUTPUTS } from "./outputs";

/*
 * JobRight's job list: each pass opens the first job card, reads the detail pane, marks
 * the job "Not interested" (which removes the card, so the next job becomes first), and
 * closes the pane. JobRight's class names are CSS-module hashes (`index_job-title__x1y2`),
 * so selectors match on their stable prefix.
 */

const JOB_CARD = "div[class*='index_job-card-main']";
const JOB_LINK = "a[href*='jobs/info/']";
const DETAIL_PANE = "div[class*='index_jobdetail-enter']";
const JOB_TAGS = "div[class*='index_jobTag__']";
const COMPANY_ROW = "h2[class*='index_company-row__']";
const DESCRIPTION_SECTION = "section[class*='index_sectionContent__']";
const NOT_INTERESTED_BUTTON = "button[id^='index_not-interest-button__']";
const NOT_INTERESTED_CONFIRM =
  "li[class='ant-dropdown-menu-item ant-dropdown-menu-item-only-child']";
const CLOSE_DETAIL_BUTTON = "button[id^='index_job-detail-close-button']";

/** The detail pane's sections, in page order: 2 responsibilities, 3 qualifications, 4 benefits. */
const DESCRIPTION_SECTIONS = [2, 3, 4];

export default defineRoutine({
  id: "jobright",
  label: "JobRight",
  version: 1,
  match: { hosts: ["jobright.ai"] },
  output: ROUTINE_OUTPUTS.JOB,
  options: { highlightFields: true, fieldPauseMs: 100 },

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

  fields: {
    "company.logo": prop("img[class*='index_company-logo-img__']", "src", { label: "Logo" }),
    applyLink: prop("a[class*='index_origin__']", "href", { label: "Apply link" }),
    tags: text(JOB_TAGS, { then: ["lines"], label: "Job tags" }),
    applicants: text(JOB_TAGS, { then: ["countedText"] }),
    "company.name": text(COMPANY_ROW, { inner: "span", innerNth: 0, label: "Company" }),
    postedAgo: text(COMPANY_ROW, {
      inner: "span",
      innerNth: 1,
      then: [["replace", " · ", ""]],
      label: "Posted",
    }),
    title: text("h1[class*='index_job-title__']", { label: "Job title" }),
    details: pairs("div[class*='index_job-metadata-row__']", {
      inner: "div[class*='index_job-metadata-item__']",
      key: ["img", "attr:alt"],
      value: ["span", "textContent"],
      label: "Job details",
    }),
    description: text(DESCRIPTION_SECTION, { nth: DESCRIPTION_SECTIONS, join: "\n\n" }),
    "company.tags": text("div[class*='index_companyTags']", {
      inner: "span.ant-tag",
      all: true,
      label: "Company tags",
    }),
    skills: text("div[class*='index_skill-matching-tags-area__']", { then: ["lines"] }),
    companyLink: prop("a[class^='index_company-link']", "href", {
      then: ["httpUrl"],
      label: "Website",
    }),
  },
});
