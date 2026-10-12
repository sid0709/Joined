import { spawnSync } from "node:child_process";

import { AUDIT_FRONTENDS } from "./audit-frontends.mjs";
import { repoRoot } from "./workspaces.mjs";

/** `.env` switch. Bun loads the root `.env` automatically, so `process.env` sees it. */
export const AUDIT_TEST_MODE_ENV = "AUDIT_TEST_MODE";
/** Set by the runner so the Unlighthouse config knows which app it is scanning. */
export const AUDIT_TARGET_ENV = "AUDIT_TARGET_ID";
/** Session token minted for this scan; read by the Unlighthouse config hook. */
export const AUDIT_SESSION_TOKEN_ENV = "AUDIT_SESSION_TOKEN";

const AUDIT_SESSION_COMMAND = "github.com/sid0709/Joined/backend-core/cmd/auditsession";
const AUTH_COOKIE_DOMAIN = "localhost";
const AUTH_COOKIE_PATH = "/";
const AUTH_NAVIGATION_TIMEOUT_MS = 30_000;

/** Connected signs in with a browser-only mock; these keys mirror connected-frontend MockAuthContext. */
const MOCK_USERS_STORAGE_KEY = "os_mock_db_users";
const MOCK_ACTIVE_USER_STORAGE_KEY = "os_mock_db_active";
const MOCK_AUDIT_USER = {
  email: "audit@localhost",
  passwordText: "",
  fullName: "Audit User",
  role: "Candidate",
};

/**
 * auditsession exits 3 when it refuses on purpose (a staff session on a non-local database).
 * `go run` itself always exits 1 and reports the program's code as this line on stderr.
 */
const AUDIT_SESSION_REFUSED_LINE = /^exit status 3$/m;

/**
 * How each audited app is signed in during test mode.
 * - `session` + `sessionKind: "user"`: one pinned test account. The id (the `id` field, not `_id`)
 *   and the email in `.env` must name the same account. `cookie` mirrors the frontend's session
 *   cookie constant.
 * - `session` + `sessionKind: "staff"`: the staff console, only against a local database.
 * - `mock`: connected-frontend's localStorage login, seeded with a fake user.
 */
export const AUDIT_LOGIN = {
  "joined-frontend": {
    kind: "session",
    backend: "joined-backend",
    sessionKind: "user",
    userIdEnv: "AUDIT_TEST_USER_ID",
    emailEnv: "AUDIT_TEST_EMAIL",
    cookie: "joined_session",
  },
  "scoutwell-frontend": {
    kind: "session",
    backend: "scoutwell-backend",
    sessionKind: "user",
    userIdEnv: "AUDIT_SCOUT_USER_ID",
    emailEnv: "AUDIT_SCOUT_EMAIL",
    cookie: "scoutwell_session",
  },
  "admin-frontend": {
    kind: "session",
    backend: "admin-backend",
    sessionKind: "staff",
    cookie: "joined_admin_session",
  },
  "connected-frontend": { kind: "mock" },
};

/** @returns {boolean} True when `.env` sets `AUDIT_TEST_MODE=true`. */
export function auditTestModeEnabled(env = process.env) {
  return env[AUDIT_TEST_MODE_ENV]?.trim().toLowerCase() === "true";
}

/**
 * @param {string} siteUrl A `--site` URL such as `http://localhost:6002/company`.
 * @returns {(typeof AUDIT_FRONTENDS)[number] | undefined} The audited app on that port.
 */
export function auditTargetForSite(siteUrl) {
  const port = new URL(siteUrl).port;
  return AUDIT_FRONTENDS.find((target) => String(target.port) === port);
}

function runAuditSessionCommand(login, args) {
  return spawnSync(
    "go",
    ["run", "-C", login.backend, AUDIT_SESSION_COMMAND, "-kind", login.sessionKind, ...args],
    { cwd: repoRoot, encoding: "utf8" },
  );
}

function commandError(result) {
  return new Error((result.stderr || result.error?.message || "auditsession failed").trim());
}

/**
 * Mints a session for the target before its scan.
 * @param {{ id: string, label: string }} target
 * @returns {{ status: "none" } | { status: "skipped", reason: string } |
 *   { status: "signed-in", token: string, email: string }}
 */
export function issueAuditSession(target, env = process.env) {
  const login = AUDIT_LOGIN[target.id];
  if (login?.kind !== "session") return { status: "none" };

  let accountArgs = [];
  if (login.sessionKind === "user") {
    const userId = env[login.userIdEnv]?.trim();
    const email = env[login.emailEnv]?.trim();
    if (!userId || !email) {
      return {
        status: "skipped",
        reason: `set ${login.userIdEnv} and ${login.emailEnv} in .env to sign in`,
      };
    }
    accountArgs = ["-user-id", userId, "-email", email];
  }

  const result = runAuditSessionCommand(login, ["-action", "issue", ...accountArgs]);
  if (result.status !== 0 && AUDIT_SESSION_REFUSED_LINE.test(result.stderr)) {
    return {
      status: "skipped",
      reason: `staff sessions need ${login.backend}'s MONGO_URI to be a local database`,
    };
  }
  if (result.status !== 0) throw commandError(result);
  return { status: "signed-in", ...JSON.parse(result.stdout) };
}

/** Deletes the session minted by issueAuditSession. */
export function revokeAuditSession(target, token) {
  const login = AUDIT_LOGIN[target.id];
  if (login?.kind !== "session" || !token) return;
  const result = runAuditSessionCommand(login, ["-action", "revoke", "-token", token]);
  if (result.status !== 0) throw commandError(result);
}

/**
 * The session cookie for the target, as Unlighthouse `cookies`. Unlighthouse sends these on the
 * crawler's HTML requests and sets them in every Lighthouse page, so every scanned page is signed in.
 * @param {{ id: string }} target
 * @returns {{ name: string, value: string, domain: string, path: string }[]}
 */
export function auditSessionCookies(target, env = process.env) {
  const login = AUDIT_LOGIN[target.id];
  const token = env[AUDIT_SESSION_TOKEN_ENV];
  if (login?.kind !== "session" || !token) return [];
  return [{ name: login.cookie, value: token, domain: AUTH_COOKIE_DOMAIN, path: AUTH_COOKIE_PATH }];
}

/** @returns {boolean} True when the target signs in through the browser mock (connected-frontend). */
export function usesMockLogin(target) {
  return AUDIT_LOGIN[target.id]?.kind === "mock";
}

/**
 * Unlighthouse `authenticate` hook for the browser mock login. It visits the site first, because
 * Unlighthouse saves only the storage of the page the hook leaves open.
 * @param {import("puppeteer-core").Page} page
 * @param {{ site: string }} target
 */
export async function seedMockLogin(page, target) {
  await page.goto(target.site, {
    waitUntil: "domcontentloaded",
    timeout: AUTH_NAVIGATION_TIMEOUT_MS,
  });
  await page.evaluate(
    (usersKey, activeKey, user) => {
      localStorage.setItem(usersKey, JSON.stringify([user]));
      localStorage.setItem(activeKey, JSON.stringify(user));
    },
    MOCK_USERS_STORAGE_KEY,
    MOCK_ACTIVE_USER_STORAGE_KEY,
    MOCK_AUDIT_USER,
  );
}
