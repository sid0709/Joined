import { describe, expect, test } from "bun:test";
import { isCompanyModeEnabled } from "./config";

describe("config", () => {
  test("isCompanyModeEnabled reads NEXT_PUBLIC_COMPANY_MODE_ENABLED", () => {
    const original = process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    try {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "true";
      expect(isCompanyModeEnabled()).toBe(true);
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "false";
      expect(isCompanyModeEnabled()).toBe(false);
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = undefined;
      expect(isCompanyModeEnabled()).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = original;
    }
  });
});
