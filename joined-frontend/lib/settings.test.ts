import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MIN_MATCH,
  estimateWeeklyMatches,
  MATCH_MAX,
  MATCH_MIN,
  parseSettingsSection,
  SETTINGS_SECTIONS,
  WEEKLY_MATCHES_AT_MIN,
} from "./settings";

describe("settings sections", () => {
  test("billing is a personal settings section", () => {
    expect(SETTINGS_SECTIONS.some((item) => item.id === "billing")).toBe(true);
  });

  test("parseSettingsSection accepts known ids only", () => {
    expect(parseSettingsSection("billing")).toBe("billing");
    expect(parseSettingsSection(["account"])).toBe("account");
    expect(parseSettingsSection("nope")).toBe(undefined);
    expect(parseSettingsSection(undefined)).toBe(undefined);
  });

  test("estimateWeeklyMatches scales from the 50% bar down to at least one", () => {
    expect(estimateWeeklyMatches(MATCH_MIN)).toBe(WEEKLY_MATCHES_AT_MIN);
    expect(estimateWeeklyMatches(MATCH_MAX)).toBe(1);
    expect(estimateWeeklyMatches(DEFAULT_MIN_MATCH)).toBe(20);
  });
});
