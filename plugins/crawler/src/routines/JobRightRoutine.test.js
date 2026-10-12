import { describe, expect, test } from "bun:test";

import { CORE_JOB_FIELD_KEYS } from "../routineKit/declaredFields.js";
import { findRoutineForUrl } from "../routineKit/match.js";
import { listDeclaredFields } from "../routineKit/routine.js";
import { RoutineFinishedError, runRoutinePass } from "../routineKit/runner.js";

import {
  CLOSE_DETAIL_BUTTON,
  JOB_LINK,
  NOT_INTERESTED_BUTTON,
  NOT_INTERESTED_CONFIRM,
} from "./jobright/constants.js";
import "./jobright/testing/domParser.js";
import { loadFixture } from "./jobright/testing/loadFixture.js";
import JobRightRoutine from "./JobRightRoutine.js";

import { ROUTINES } from "./index.js";

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

function jobRightTab({
  jobsLeft = 1,
  html = loadFixture("detail-next-data.html"),
  url = "https://jobright.ai/jobs/info/6acd0fe6e7a1d9333210fcaf",
  details = {},
} = {}) {
  const clicks = [];
  let detailOpen = false;
  const fetches = [];
  const exec = async (op) => {
    if (op.op === "click") {
      clicks.push(op.selector);
      if (op.selector === JOB_LINK) {
        if (jobsLeft === 0) return { found: false };
        jobsLeft -= 1;
        detailOpen = true;
      }
      if (op.selector === CLOSE_DETAIL_BUTTON) detailOpen = false;
      return { found: true };
    }
    if (op.op === "count") return { count: detailOpen ? 1 : 0 };
    if (op.op === "html") return { html, url };
    if (op.op === "fetch") {
      fetches.push(op.url);
      return { html: details[op.url] ?? html, url: op.url, status: 200 };
    }
    return {};
  };
  return { exec, clicks, fetches };
}

describe("JobRightRoutine", () => {
  test("is registered for jobright.ai and declares the required core", () => {
    expect(findRoutineForUrl(ROUTINES, "https://jobright.ai/jobs/recommend")).toBe(JobRightRoutine);
    expect(findRoutineForUrl(ROUTINES, "https://example.com/jobs")).toBeNull();
    const keys = listDeclaredFields(JobRightRoutine).map((field) => field.key);
    for (const key of CORE_JOB_FIELD_KEYS) {
      expect(keys).toContain(key);
      expect(listDeclaredFields(JobRightRoutine).find((field) => field.key === key).required).toBe(
        true,
      );
    }
    expect(keys).toContain("workMode");
    expect(keys).toContain("companySocial");
    expect(keys).toContain("skills");
    expect(JobRightRoutine.runView.groups.some((group) => group.id === "skills")).toBe(true);
    expect(JobRightRoutine.runView.settings).toEqual([]);
  });

  test("reads a job from __NEXT_DATA__ into the ingest core plus metadata fields", async () => {
    const tab = jobRightTab();
    let record = null;
    await runRoutinePass(routine, {
      exec: tab.exec,
      onRecord: (value) => {
        record = value;
      },
    });
    expect(record.title).toBe("Machine Learning Engineer");
    expect(record.companyName).toBe("TAJ Technologies, Inc.");
    expect(record.applyUrl).toContain("linkedin.com/jobs/view");
    expect(record.workMode).toBe("remote");
    expect(record.applicantCount).toBe(25);
    expect(tab.clicks).toEqual([
      JOB_LINK,
      NOT_INTERESTED_BUTTON,
      NOT_INTERESTED_CONFIRM,
      CLOSE_DETAIL_BUTTON,
    ]);
  });

  test("fetches /jobs/info when the list overlay has no job JSON", async () => {
    const detailUrl = "https://jobright.ai/jobs/info/abc123";
    const tab = jobRightTab({
      html: loadFixture("list-overlay.html"),
      url: "https://jobright.ai/jobs/recommend",
      details: { [detailUrl]: loadFixture("detail-next-data.html") },
    });
    let record = null;
    await runRoutinePass(routine, {
      exec: tab.exec,
      onRecord: (value) => {
        record = value;
      },
    });
    expect(tab.fetches).toContain(detailUrl);
    expect(record.companyName).toBe("TAJ Technologies, Inc.");
  });

  test("finishes the run when no job cards are left", async () => {
    const pass = runRoutinePass(routine, { exec: jobRightTab({ jobsLeft: 0 }).exec });
    await expect(pass).rejects.toBeInstanceOf(RoutineFinishedError);
  });
});
