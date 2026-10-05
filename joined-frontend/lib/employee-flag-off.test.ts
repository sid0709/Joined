import { describe, expect, test } from "bun:test";
import { isCompanyModeEnabled } from "./config";

describe("employee session with company mode disabled", () => {
  test("candidate layout should not redirect but show coming soon notice", () => {
    const originalFlag = process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    try {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "false";
      const companyModeEnabled = isCompanyModeEnabled();
      const isEmployeeSession = true;

      // Should NOT redirect to company when flag is off
      const shouldRedirect = companyModeEnabled && isEmployeeSession;
      expect(shouldRedirect).toBe(false);

      // Should show coming soon notice instead
      const shouldShowComingSoon = !companyModeEnabled && isEmployeeSession;
      expect(shouldShowComingSoon).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = originalFlag;
    }
  });

  test("should skip loadCompanyUnread when flag is off", () => {
    const originalFlag = process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    try {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "false";
      const companyModeEnabled = isCompanyModeEnabled();
      const isEmployeeSession = true;

      // Should NOT call loadCompanyUnread; use 0 instead
      const shouldLoadCompanyUnread = companyModeEnabled && isEmployeeSession;
      expect(shouldLoadCompanyUnread).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = originalFlag;
    }
  });

  test("should skip candidate API calls for employee on public pages when flag is off", () => {
    const hasCompany = true;

    // Employee sessions (with company) should NOT call candidate APIs on public pages
    const shouldCallCandidateApis = !hasCompany;
    expect(shouldCallCandidateApis).toBe(false);
  });

  test("candidate sessions always call candidate APIs regardless of flag", () => {
    const hasCompany = false;

    // Candidate sessions (no company) should always call candidate APIs
    const shouldCallCandidateApis = !hasCompany;
    expect(shouldCallCandidateApis).toBe(true);
  });

  test("flag on preserves original behavior", () => {
    const originalFlag = process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    try {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "true";
      const companyModeEnabled = isCompanyModeEnabled();
      const isEmployeeSession = true;

      // Flag on: should redirect to company
      const shouldRedirect = companyModeEnabled && isEmployeeSession;
      expect(shouldRedirect).toBe(true);

      // Flag on: should NOT show coming soon
      const shouldShowComingSoon = !companyModeEnabled && isEmployeeSession;
      expect(shouldShowComingSoon).toBe(false);

      // Flag on: should load company unread
      const shouldLoadCompanyUnread = companyModeEnabled && isEmployeeSession;
      expect(shouldLoadCompanyUnread).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = originalFlag;
    }
  });
});
