import { describe, expect, test } from "bun:test";

import { findRoutineForUrl, findRoutinesForUrl, hostMatches, routineMatchesUrl } from "./match.js";

const jobs = { id: "jobs", match: { hosts: ["jobs.example"] } };
const other = { id: "other", match: { hosts: ["other.example"] } };

describe("routine matching", () => {
  test("matches a host and its subdomains, not look-alikes", () => {
    expect(hostMatches("jobs.example", ["jobs.example"])).toBe(true);
    expect(hostMatches("WWW.Jobs.Example", ["jobs.example"])).toBe(true);
    expect(hostMatches("notjobs.example", ["jobs.example"])).toBe(false);
    expect(hostMatches(undefined, ["jobs.example"])).toBe(false);
  });

  test("matches only http(s) pages", () => {
    expect(routineMatchesUrl(jobs, "https://jobs.example/list")).toBe(true);
    expect(routineMatchesUrl(jobs, "file://jobs.example/list")).toBe(false);
    expect(routineMatchesUrl(jobs, "not a url")).toBe(false);
  });

  test("finds the routine for a page", () => {
    expect(findRoutineForUrl([jobs, other], "https://other.example/")).toBe(other);
    expect(findRoutineForUrl([jobs, other], "https://unknown.example/")).toBeNull();
    const alsoJobs = { id: "also", match: { hosts: ["example", "jobs.example"] } };
    expect(findRoutinesForUrl([jobs, other, alsoJobs], "https://jobs.example/")).toEqual([
      jobs,
      alsoJobs,
    ]);
  });
});
