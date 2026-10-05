import { describe, expect, test } from "bun:test";

import { extractField } from "../routineKit/extract.js";
import { findRoutineForUrl } from "../routineKit/match.js";
import { RoutineFinishedError, runRoutinePass } from "../routineKit/runner.js";
import { fakeElement, fakeRoot } from "../routineKit/testing/fakeDom.js";

import JobRightRoutine from "./JobRightRoutine.js";

import { ROUTINES } from "./index.js";

// The routine without its fixed pauses, so the test runs in milliseconds.
const STRATEGY_PHASES = ["open", "ready", "dismiss", "settle"];
const routine = {
  ...JobRightRoutine,
  options: { ...JobRightRoutine.options, fieldPauseMs: 0 },
  strategy: {
    ...JobRightRoutine.strategy,
    ...Object.fromEntries(
      STRATEGY_PHASES.map((phase) => [
        phase,
        JobRightRoutine.strategy[phase].filter((step) => step.kind !== "pause"),
      ]),
    ),
  },
};

const span = (text) => fakeElement({ text, textContent: text });

/** A JobRight detail pane, keyed by the routine's selectors. */
const detailPage = fakeRoot({
  "img[class*='index_company-logo-img__']": [
    fakeElement({ props: { src: "https://cdn.jobright.ai/logo.png" } }),
  ],
  "a[class*='index_origin__']": [fakeElement({ props: { href: "https://acme.com/apply/42" } })],
  "div[class*='index_jobTag__']": [fakeElement({ text: "Early applicant\n 25 applicants \n" })],
  "h2[class*='index_company-row__']": [
    fakeElement({ children: { span: [span("Acme"), span("3 hours ago · ")] } }),
  ],
  "h1[class*='index_job-title__']": [fakeElement({ text: "Senior Engineer" })],
  "div[class*='index_job-metadata-row__']": [
    fakeElement({
      children: {
        "div[class*='index_job-metadata-item__']": [
          fakeElement({
            children: {
              img: [fakeElement({ attrs: { alt: "location" } })],
              span: [span(" Remote ")],
            },
          }),
          fakeElement({
            children: { img: [fakeElement({ attrs: { alt: "salary" } })], span: [span("$150K")] },
          }),
        ],
      },
    }),
  ],
  "section[class*='index_sectionContent__']": [
    fakeElement({ text: "Summary" }),
    fakeElement({ text: "Company" }),
    fakeElement({ text: "Build things." }),
    fakeElement({ text: "5 years of Go." }),
    fakeElement({ text: "Remote-first." }),
  ],
  "div[class*='index_companyTags']": [
    fakeElement({ children: { "span.ant-tag": [span("SaaS"), span("Series B")] } }),
  ],
  "div[class*='index_skill-matching-tags-area__']": [fakeElement({ text: "Go\nReact\n" })],
  "a[class^='index_company-link']": [fakeElement({ props: { href: "https://acme.com/" } })],
});

/** Answers the runner's ops the way the content script would on this page. */
function jobRightTab({ jobsLeft = 1 } = {}) {
  const clicks = [];
  let detailOpen = false;
  const exec = async ({ op, selector, field }) => {
    if (op === "click") {
      clicks.push(selector);
      if (selector === "a[href*='jobs/info/']") {
        if (jobsLeft === 0) return { found: false };
        jobsLeft -= 1;
        detailOpen = true;
      }
      if (selector === "button[id^='index_job-detail-close-button']") detailOpen = false;
      return { found: true };
    }
    if (op === "count") return { count: detailOpen ? 1 : 0 };
    if (op === "extract") return extractField(detailPage, field);
    return {};
  };
  return { exec, clicks };
}

describe("JobRightRoutine", () => {
  test("is registered for jobright.ai", () => {
    expect(findRoutineForUrl(ROUTINES, "https://jobright.ai/jobs/recommend")).toBe(JobRightRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://example.com/jobs")).toBeNull();
  });

  test("reads a job into the shape the ingest API expects", async () => {
    const tab = jobRightTab();
    let record = null;
    await runRoutinePass(routine, {
      exec: tab.exec,
      onRecord: (value) => {
        record = value;
      },
    });

    expect(record).toEqual({
      company: {
        logo: "https://cdn.jobright.ai/logo.png",
        name: "Acme",
        tags: ["SaaS", "Series B"],
      },
      applyLink: "https://acme.com/apply/42",
      tags: ["Early applicant", "25 applicants"],
      applicants: { count: 25, text: "Early applicant\n 25 applicants \n" },
      postedAgo: "3 hours ago",
      title: "Senior Engineer",
      details: { location: "Remote", salary: "$150K" },
      description: "Build things.\n\n5 years of Go.\n\nRemote-first.",
      skills: ["Go", "React"],
      companyLink: "https://acme.com/",
    });
    expect(tab.clicks).toEqual([
      "a[href*='jobs/info/']",
      "button[id^='index_not-interest-button__']",
      "li[class='ant-dropdown-menu-item ant-dropdown-menu-item-only-child']",
      "button[id^='index_job-detail-close-button']",
    ]);
  });

  test("finishes the run when no job cards are left", async () => {
    const pass = runRoutinePass(routine, { exec: jobRightTab({ jobsLeft: 0 }).exec });
    await expect(pass).rejects.toBeInstanceOf(RoutineFinishedError);
  });
});
