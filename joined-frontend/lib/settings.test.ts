import { describe, expect, test } from "bun:test";
import { parseSettingsSection, SETTINGS_SECTIONS } from "./settings";

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
});
