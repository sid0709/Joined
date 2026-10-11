import {
  AUDIT_TARGET_ENV,
  auditSessionCookies,
  auditTestModeEnabled,
  seedMockLogin,
  usesMockLogin,
} from "./tools/audit-auth.mjs";
import { AUDIT_FRONTENDS } from "./tools/audit-frontends.mjs";
import { AUDIT_ROUTE_PLAN_ENV } from "./tools/audit-routes.mjs";

/** Crawls never follow links into API routes (downloads, OAuth redirects). */
const CRAWL_EXCLUDE = [/^\/api\//];

/** @param {{ name: string, value: string }[]} cookies @returns {string} A `Cookie` header value. */
function cookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

/** Matches a page path with or without a query string, e.g. `/sign-in` and `/sign-in?next=%2F`. */
function exactPathPattern(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}(?:\\?|$)`);
}

/** The runner's route plan: `seed` pages to scan, `skip` pages that redirect for this visitor. */
function routePlan() {
  const raw = process.env[AUDIT_ROUTE_PLAN_ENV];
  return raw ? JSON.parse(raw) : { seed: [], skip: [] };
}

/**
 * Adds every app page that renders for this visitor to the first batch of crawled links, so
 * pages no link points at are still scanned. Pages with an `[id]` come from crawled links.
 */
function seedAppRoutes(seed) {
  let seeded = false;
  return (_path, internalLinks) => {
    if (seeded) return;
    seeded = true;
    internalLinks.push(...seed);
  };
}

/** Runs in the Unlighthouse child process. The runner sets AUDIT_TARGET_ID for each app. */
function auditConfig() {
  const target = AUDIT_FRONTENDS.find((entry) => entry.id === process.env[AUDIT_TARGET_ENV]);
  if (!target) {
    return {};
  }
  const testMode = auditTestModeEnabled();
  const cookies = testMode ? auditSessionCookies(target) : [];
  const { seed, skip } = routePlan();
  return {
    scanner: {
      exclude: [...CRAWL_EXCLUDE, ...skip.map(exactPathPattern)],
      // Render pages before collecting links: several apps only draw their navigation in the browser.
      skipJavascript: false,
    },
    ...(cookies.length > 0 ? { cookies } : {}),
    // Lighthouse clears the site's cookies and storage before each page unless told not to, and its
    // own tab can miss cookies set on the crawler's page. Sending the session as a request header
    // too keeps every Lighthouse run signed in.
    ...(testMode
      ? {
          lighthouseOptions: {
            disableStorageReset: true,
            ...(cookies.length > 0 ? { extraHeaders: { Cookie: cookieHeader(cookies) } } : {}),
          },
        }
      : {}),
    hooks: {
      "discovered-internal-links": seedAppRoutes(seed),
      ...(testMode && usesMockLogin(target)
        ? { authenticate: (page) => seedMockLogin(page, target) }
        : {}),
    },
  };
}

export default auditConfig();
