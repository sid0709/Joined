import { describe, expect, test } from "bun:test";

import {
  emptyDateRange,
  emptyProfile,
  formatAddress,
  formatSalary,
  isValidDateRange,
  normalizeProfile,
  optionLabel,
  strengthPercent,
  strengthSteps,
} from "@/lib/profile";

describe("profile helpers", () => {
  test("rejects a month without a year and accepts an open-ended range", () => {
    const range = emptyDateRange();
    expect(isValidDateRange({ ...range, startMonth: 3 })).toBe(false);
    expect(isValidDateRange({ ...range, endMonth: 1 })).toBe(false);
    expect(isValidDateRange({ ...range, current: true, startMonth: 1, startYear: 2020 })).toBe(
      true,
    );
    expect(
      isValidDateRange({
        startMonth: 6,
        startYear: 2024,
        endMonth: 1,
        endYear: 2024,
        current: false,
      }),
    ).toBe(false);
  });

  test("fills missing fields and scores a completed profile", () => {
    const profile = normalizeProfile({
      headline: "Designer",
      phone: "555",
      location: "Chicago",
      homeAddress: { line: "1 Main", city: "Chicago", region: "", postalCode: "", country: "" },
      targetRoles: ["Design"],
      experience: [
        { ...emptyDateRange(), id: "e", role: "IC", company: "Joined", period: "", summary: "" },
      ],
      education: [
        {
          ...emptyDateRange(),
          id: "s",
          school: "UIC",
          degree: "",
          field: "",
          period: "",
          summary: "",
        },
      ],
    });
    expect(profile.workplace).toBe("hybrid");
    expect(profile.visibility.openToWork).toBe(true);
    expect(normalizeProfile(null).name).toBe("");
    const steps = strengthSteps(profile, true);
    expect(steps.every((step) => step.done)).toBe(true);
    expect(strengthPercent(steps)).toBe(100);
    expect(strengthPercent([])).toBe(0);
    expect(formatSalary(120000, "USD")).toBe("$120,000");
    expect(optionLabel([{ value: "us", label: "United States" }], "us")).toBe("United States");
    expect(optionLabel([], "us")).toBe("us");
    expect(formatAddress(profile.homeAddress)).toBe("1 Main, Chicago");
    expect(formatAddress(emptyProfile().homeAddress)).toBe("");
  });
});
