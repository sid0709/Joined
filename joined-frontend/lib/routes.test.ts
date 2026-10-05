import { describe, expect, test } from "bun:test";
import {
  AUTH_PAGE_PATHS,
  HIRING_SIGN_UP_HREF,
  ROUTES,
  SETTINGS_SECTION_QUERY,
  settingsSectionHref,
  signInHref,
} from "./routes";

describe("routes", () => {
  test("sign-in keeps the page the person was opening", () => {
    expect(signInHref("/applications")).toBe("/sign-in?next=%2Fapplications");
    expect(signInHref("/jobs/abc")).toBe("/sign-in?next=%2Fjobs%2Fabc");
  });

  test("dynamic paths encode their ids", () => {
    expect(ROUTES.job("abc")).toBe("/jobs/abc");
    expect(ROUTES.companyPublic("north")).toBe("/companies/north");
    expect(ROUTES.companyJobEdit("j 1")).toBe("/company/jobs/j%201/edit");
    expect(ROUTES.schedule("k/1")).toBe("/schedule/k%2F1");
    expect(ROUTES.offerSign("a 1")).toBe("/offer/sign/a%201");
  });

  test("premium billing return paths sit under settings", () => {
    expect(ROUTES.pricing).toBe("/pricing");
    expect(ROUTES.billingSuccess).toBe("/settings/billing/success");
    expect(ROUTES.billingCancel).toBe("/settings/billing/cancel");
    expect(settingsSectionHref("billing")).toBe(
      `${ROUTES.settings}?${SETTINGS_SECTION_QUERY}=billing`,
    );
  });

  test("email auth screens stay on the public auth list", () => {
    expect(HIRING_SIGN_UP_HREF).toBe("/sign-up?intent=hiring");
    expect(AUTH_PAGE_PATHS).toContain(ROUTES.checkEmail);
    expect(AUTH_PAGE_PATHS).toContain(ROUTES.verifyEmail);
    expect(AUTH_PAGE_PATHS).toContain(ROUTES.forgotPassword);
    expect(AUTH_PAGE_PATHS).toContain(ROUTES.resetPassword);
  });
});
