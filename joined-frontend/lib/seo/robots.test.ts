import { describe, expect, test } from "bun:test";

import { ROUTES } from "@/lib/routes";

import {
  COMPANY_DASHBOARD_EXACT,
  COMPANY_DASHBOARD_PREFIX,
  COMPANIES_PATH_PREFIX,
  JOBS_PATH_PREFIX,
} from "./constants";
import { publicRobots, ROBOTS_ALLOW, ROBOTS_DISALLOW } from "./robots";

const ORIGIN = "https://joined.test";

describe("robots.txt helpers", () => {
  test("allows public search, jobs, companies, and pricing", () => {
    expect(ROBOTS_ALLOW).toEqual(["/", JOBS_PATH_PREFIX, COMPANIES_PATH_PREFIX, ROUTES.pricing]);
  });

  test("disallows auth and signed-in paths without blocking /companies", () => {
    expect(ROBOTS_DISALLOW).toContain(ROUTES.signIn);
    expect(ROBOTS_DISALLOW).toContain(ROUTES.applications);
    expect(ROBOTS_DISALLOW).toContain(ROUTES.settings);
    expect(ROBOTS_DISALLOW).toContain(COMPANY_DASHBOARD_EXACT);
    expect(ROBOTS_DISALLOW).toContain(COMPANY_DASHBOARD_PREFIX);
    expect(ROBOTS_DISALLOW).not.toContain("/company");
    expect(ROBOTS_DISALLOW.some((path) => path.startsWith("/companies"))).toBe(false);
  });

  test("points crawlers at sitemap when the public origin is set", () => {
    expect(publicRobots(ORIGIN)).toEqual({
      rules: {
        userAgent: "*",
        allow: ROBOTS_ALLOW,
        disallow: ROBOTS_DISALLOW,
      },
      sitemap: `${ORIGIN}/sitemap.xml`,
    });
  });

  test("omits sitemap without a public origin", () => {
    expect(publicRobots("").sitemap).toBeUndefined();
  });
});
