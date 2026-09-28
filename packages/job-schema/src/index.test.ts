import { expect, test } from "bun:test";

import enums from "../enums.json";
import {
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
} from "./index";

function pairs<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

test("enums.json matches the TypeScript job enums", () => {
  expect(enums.currency).toBe(DEFAULT_CURRENCY);
  expect(enums.workplace).toEqual(pairs(WORKPLACES, WORKPLACE_LABEL));
  expect(enums.seniority).toEqual(pairs(SENIORITIES, SENIORITY_LABEL));
  expect(enums.employment).toEqual(pairs(EMPLOYMENTS, EMPLOYMENT_LABEL));
  expect(enums.payPeriod).toEqual(pairs(PAY_PERIODS, PAY_PERIOD_LABEL));
  expect(enums.seniorityAliases).toEqual(SENIORITY_ALIASES);
});
