import {
  AUDIT_TARGET_ENV,
  auditSessionCookies,
  auditTestModeEnabled,
  seedMockLogin,
  usesMockLogin,
} from "./tools/audit-auth.mjs";
import { AUDIT_FRONTENDS } from "./tools/audit-frontends.mjs";
import { appPageRoutes, isDynamicRoute, reachableRoutes } from "./tools/audit-routes.mjs";

/** Crawls never follow links into API routes (downloads, OAuth redirects). */
const CRAWL_EXCLUDE = [/^\/api\//];

/** Matches a page path with or without a query string, e.g. `/sign-in` and `/sign-in?next=%2F`. */
function exactPathPattern(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}(?:\\?|$)`);
}

/**
 * Seeds the crawl with every static page in the app folder that renders for this visitor, so
 * pages no link points at are still scanned. Pages with an `[id]` come from crawled links.
 * Pages that redirect for this visitor are excluded, so a crawled link to them never scores
 * the redirect target a second time under the wrong name.
 */
function seedAppRoutes(target, cookies, scanner) {
  let seeded = false;
  return async (_path, internalLinks) => {
    if (seeded) return;
    seeded = true;
    const routes = (await appPageRoutes(target.workspace)).filter(
      (route) => !isDynamicRoute(route),
    );
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const { reachable, skipped } = await reachableRoutes(target.site, routes, cookieHeader);
    console.log(`\nSeeding ${reachable.length} app pages for ${target.label}.`);
    if (skipped.length > 0) {
      const list = skipped.map(({ route, status }) => `${route} (${status || "error"})`).join(", ");
      console.log(`Not scanned, they redirect or fail for this visitor: ${list}\n`);
    }
    scanner.current?.exclude.push(...skipped.map(({ route }) => exactPathPattern(route)));
    internalLinks.push(...reachable);
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
  /** The live scanner settings; Unlighthouse reads `exclude` from it each time it queues a page. */
  const scanner = { current: null };
  return {
    // Render pages before collecting links: several apps only draw their navigation in the browser.
    scanner: { exclude: CRAWL_EXCLUDE, skipJavascript: false },
    ...(cookies.length > 0 ? { cookies } : {}),
    // Lighthouse clears the site's cookies and storage before each page unless told not to,
    // which would sign the audit out at random.
    ...(testMode ? { lighthouseOptions: { disableStorageReset: true } } : {}),
    hooks: {
      "resolved-config": (resolved) => {
        scanner.current = resolved.scanner;
      },
      "discovered-internal-links": seedAppRoutes(target, cookies, scanner),
      ...(testMode && usesMockLogin(target)
        ? { authenticate: (page) => seedMockLogin(page, target) }
        : {}),
    },
  };
}

export default auditConfig();
