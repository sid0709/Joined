import { expect, test } from "bun:test";

import enums from "../enums.json";

import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  EMPLOYMENTS,
  EMPLOYMENT_LABEL,
  PAY_PERIODS,
  PAY_PERIOD_LABEL,
  SENIORITIES,
  SENIORITY_ALIASES,
  SENIORITY_LABEL,
  WORKPLACES,
  WORKPLACE_LABEL,
  canonicalSeniority,
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
