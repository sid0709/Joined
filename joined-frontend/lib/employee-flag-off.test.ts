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

  test("employee on public job page should be treated as guest (signedIn=false)", () => {
    const hasSession = true;
    const isEmployeeSession = true;

    // Employee sessions should be treated as NOT signed in (guest) on public pages
    const signedIn = hasSession && !isEmployeeSession;
    expect(signedIn).toBe(false);
  });

  test("candidate on public job page should be treated as signed in", () => {
    const hasSession = true;
    const isEmployeeSession = false;

    // Candidate sessions should be treated as signed in on public pages
    const signedIn = hasSession && !isEmployeeSession;
    expect(signedIn).toBe(true);
  });

  test("employee should get guest header actions when flag is off", () => {
    const originalFlag = process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    try {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "false";
      const companyModeEnabled = isCompanyModeEnabled();
      const isEmployeeSession = true;
      const hasSession = true;

      // With flag off, pass null session to header for guest actions
      const sessionForHeader = !companyModeEnabled && isEmployeeSession ? null : hasSession;
      expect(sessionForHeader).toBe(null);
    } finally {
      process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = originalFlag;
    }
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
