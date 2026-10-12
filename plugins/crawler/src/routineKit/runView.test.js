import { describe, expect, test } from "bun:test";

import {
  defaultRunView,
  defineRunView,
  fieldGroup,
  hasRunComponent,
  hasRunSetting,
  hasRunStat,
  listFieldGroups,
  listRunComponents,
  listRunSettings,
  listRunStats,
  RUN_COMPONENT,
  RUN_SETTING,
  RUN_STAT,
  runViewProblems,
} from "./runView.js";

describe("defineRunView", () => {
  test("freezes a declared Run view", () => {
    const view = defineRunView({
      groups: [fieldGroup("job", "Job", ["title"])],
      components: [RUN_COMPONENT.PACE, RUN_COMPONENT.PACE],
      stats: [RUN_STAT.JOBS_PER_SECOND],
      settings: [RUN_SETTING.CONCURRENCY],
    });
    expect(view.components).toEqual([RUN_COMPONENT.PACE]);
    expect(listRunComponents({ runView: view })).toEqual([RUN_COMPONENT.PACE]);
    expect(listRunStats({ runView: view })).toEqual([RUN_STAT.JOBS_PER_SECOND]);
    expect(listRunSettings({ runView: view })).toEqual([RUN_SETTING.CONCURRENCY]);
    expect(listFieldGroups({ runView: view })[0].fields).toEqual(["title"]);
    expect(hasRunComponent({ runView: view }, RUN_COMPONENT.PACE)).toBe(true);
    expect(hasRunStat({ runView: view }, RUN_STAT.OUTCOMES)).toBe(false);
    expect(hasRunSetting({ runView: view }, RUN_SETTING.CONCURRENCY)).toBe(true);
  });

  test("defaults and reports problems", () => {
    const fallback = defaultRunView({ declaredFields: [{ key: "title" }] });
    expect(fallback.groups[0].fields).toEqual(["title"]);
    expect(listFieldGroups({ declaredFields: [{ key: "title" }] })[0].id).toBe("fields");
    expect(listFieldGroups({})).toEqual([]);
    expect(runViewProblems(null)).toEqual([]);
    expect(runViewProblems("x")).toEqual(["runView must be an object"]);
    expect(
      runViewProblems({ groups: [fieldGroup("job", "Job", ["title", "missing"])] }, ["title"]),
    ).toContain('runView group "job" field "missing" is not declared');
    expect(() => defineRunView({ components: ["nope"] })).toThrow("unknown");
    expect(runViewProblems({ groups: "nope" })[0]).toContain("groups must be a list");
  });
});
