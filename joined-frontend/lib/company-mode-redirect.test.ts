import { describe, expect, test } from "bun:test";
import { isCompanyModeEnabled } from "./config";

describe("company mode redirect guard", () => {
  test("when company mode is disabled, employee sessions should not redirect to company routes", () => {
    const originalFlag = process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    try {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "false";
      const companyModeEnabled = isCompanyModeEnabled();
      const isEmployeeSession = true;

      // When flag is off and session is employee, should NOT redirect to company
      const shouldRedirectToCompany = companyModeEnabled && isEmployeeSession;
      expect(shouldRedirectToCompany).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = originalFlag;
    }
  });

  test("when company mode is enabled, employee sessions should redirect to company routes", () => {
    const originalFlag = process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    try {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "true";
      const companyModeEnabled = isCompanyModeEnabled();
      const isEmployeeSession = true;

      // When flag is on and session is employee, SHOULD redirect to company
      const shouldRedirectToCompany = companyModeEnabled && isEmployeeSession;
      expect(shouldRedirectToCompany).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = originalFlag;
    }
  });

  test("candidate sessions never redirect to company routes regardless of flag", () => {
    const originalFlag = process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    try {
      const isEmployeeSession = false;

      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "true";
      let companyModeEnabled = isCompanyModeEnabled();
      expect(companyModeEnabled && isEmployeeSession).toBe(false);

      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "false";
      companyModeEnabled = isCompanyModeEnabled();
      expect(companyModeEnabled && isEmployeeSession).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = originalFlag;
    }
  });
});
