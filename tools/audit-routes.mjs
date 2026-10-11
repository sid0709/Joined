import { readdir } from "node:fs/promises";
import path from "node:path";

import { repoRoot } from "./workspaces.mjs";

/** Next.js app router files that make a folder a page. */
const PAGE_FILE = /^page\.(?:tsx|ts|jsx|js|mdx)$/;
/** `(group)` folders add no URL segment. */
const ROUTE_GROUP = /^\(.+\)$/;
/** `@slot` parallel routes and `_private` folders are never URLs. */
const NON_ROUTE_FOLDER = /^[@_]/;
const APP_DIR = "app";
const REACHABILITY_TIMEOUT_MS = 30_000;
const HTTP_OK = 200;

/**
 * Every page route in a Next.js app folder, e.g. `/settings` or `/jobs/[id]`.
 * @param {string} workspace Workspace folder, relative to the repo root.
 * @returns {Promise<string[]>}
 */
export async function appPageRoutes(workspace) {
  const routes = [];
  async function walk(directory, segments) {
    const entries = await readdir(directory, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && PAGE_FILE.test(entry.name))) {
      routes.push(`/${segments.join("/")}`);
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || NON_ROUTE_FOLDER.test(entry.name)) continue;
      const next = ROUTE_GROUP.test(entry.name) ? segments : [...segments, entry.name];
      await walk(path.join(directory, entry.name), next);
    }
  }
  await walk(path.join(repoRoot, workspace, APP_DIR), []);
  return [...new Set(routes)].sort();
}

/** Routes with a `[param]` need a real id; the crawler finds those from links. */
export function isDynamicRoute(route) {
  return route.includes("[");
}

/**
 * Splits static routes into those that render for this visitor and those that redirect or fail
 * (signed-in only pages while signed out, company pages while company mode is off).
 * @param {string} site
 * @param {string[]} routes
 * @param {string} cookieHeader `name=value` pairs, or "" when signed out.
 */
export async function reachableRoutes(site, routes, cookieHeader) {
  const results = await Promise.all(
    routes.map(async (route) => {
      try {
        const response = await fetch(new URL(route, site), {
          headers: cookieHeader ? { cookie: cookieHeader } : {},
          redirect: "manual",
          signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
        });
        await response.body?.cancel();
        return { route, status: response.status };
      } catch {
        return { route, status: 0 };
      }
    }),
  );
  return {
    reachable: results.filter((result) => result.status === HTTP_OK).map((result) => result.route),
    skipped: results.filter((result) => result.status !== HTTP_OK),
  };
}
