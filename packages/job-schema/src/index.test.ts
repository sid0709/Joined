import { expect, test } from "bun:test";

import enums from "../enums.json";

import {
  COMPANY_SIZES,
  COMPANY_TYPES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  EMPLOYMENTS,
  EMPLOYMENT_LABEL,
  INDUSTRIES,
  OTHER,
  PAY_PERIODS,
  PAY_PERIOD_LABEL,
  SENIORITIES,
  SENIORITY_ALIASES,
  SENIORITY_LABEL,
  VALUE_ICONS,
  WORKPLACES,
  WORKPLACE_LABEL,
  canonicalSeniority,
  companySizeLabel,
  seniorityLabel,
} from "./index";

function pairs<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

test("enums.json matches the TypeScript job enums", () => {
  expect(enums.currency).toBe(DEFAULT_CURRENCY);
  expect(enums.currencies).toEqual([...CURRENCIES]);
  expect(enums.workplace).toEqual(pairs(WORKPLACES, WORKPLACE_LABEL));
  expect(enums.seniority).toEqual(pairs(SENIORITIES, SENIORITY_LABEL));
  expect(enums.employment).toEqual(pairs(EMPLOYMENTS, EMPLOYMENT_LABEL));
  expect(enums.payPeriod).toEqual(pairs(PAY_PERIODS, PAY_PERIOD_LABEL));
  expect(enums.seniorityAliases).toEqual(SENIORITY_ALIASES);
  expect(enums.industries).toEqual([...INDUSTRIES]);
  expect(enums.companyTypes).toEqual([...COMPANY_TYPES]);
  expect(enums.companySizes).toEqual([...COMPANY_SIZES]);
  expect(enums.valueIcons).toEqual([...VALUE_ICONS]);
});

test("company size labels add people except for Other", () => {
  expect(companySizeLabel("11–50")).toBe("11–50 people");
  expect(companySizeLabel(OTHER)).toBe("Other");
});

test("every company enum ends with Other", () => {
  for (const list of [INDUSTRIES, COMPANY_TYPES, COMPANY_SIZES]) {
    expect(list[list.length - 1]).toBe(OTHER);
  }
});

test("seniority aliases fold onto the record values in any case", () => {
  expect(canonicalSeniority(" Entry ")).toBe("Junior");
  expect(canonicalSeniority("LEAD")).toBe("Leader");
  expect(canonicalSeniority("wizard")).toBeNull();
});

test("seniority labels read the canonical value, or echo unknown ones", () => {
  expect(seniorityLabel("leader")).toBe("Lead");
  expect(seniorityLabel("mid")).toBe("Middle");
  expect(seniorityLabel("Wizard")).toBe("Wizard");
});
