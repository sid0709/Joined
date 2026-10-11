import { spawnSync } from "node:child_process";

import { AUDIT_FRONTENDS } from "./audit-frontends.mjs";
import { repoRoot } from "./workspaces.mjs";

/** `.env` switch. Bun loads the root `.env` automatically, so `process.env` sees it. */
export const AUDIT_TEST_MODE_ENV = "AUDIT_TEST_MODE";
/** Set by the runner so the Unlighthouse config knows which app it is scanning. */
export const AUDIT_TARGET_ENV = "AUDIT_TARGET_ID";
/** Session token minted for this scan; read by the Unlighthouse config hook. */
export const AUDIT_SESSION_TOKEN_ENV = "AUDIT_SESSION_TOKEN";

const AUDIT_SESSION_COMMAND = "github.com/sid0709/OpenSeat/backend-core/cmd/auditsession";
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
 * How each audited app is signed in during test mode.
 * - `session`: a short session minted in that backend's local database. `cookie` mirrors the
 *   frontend's session cookie constant. `sessionKind: "staff"` is the staff console.
 * - `mock`: connected-frontend's localStorage login, seeded with a fake user.
 */
export const AUDIT_LOGIN = {
  "joined-frontend": {
    kind: "session",
    backend: "joined-backend",
    sessionKind: "user",
    role: "candidate",
    cookie: "joined_session",
  },
  "scoutwell-frontend": {
    kind: "session",
    backend: "scoutwell-backend",
    sessionKind: "user",
    role: "scout",
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
  const result = spawnSync(
    "go",
    ["run", "-C", login.backend, AUDIT_SESSION_COMMAND, "-kind", login.sessionKind, ...args],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.error?.message || "auditsession failed").trim());
  }
  return result.stdout;
}

/**
 * Mints a session for the target before its scan. Returns null for apps that need none.
 * @param {{ id: string }} target
 * @returns {{ token: string, email: string } | null}
 */
export function issueAuditSession(target) {
  const login = AUDIT_LOGIN[target.id];
  if (login?.kind !== "session") return null;
  const roleArgs = login.sessionKind === "user" ? ["-role", login.role] : [];
  return JSON.parse(runAuditSessionCommand(login, ["-action", "issue", ...roleArgs]));
}

/** Deletes the session minted by issueAuditSession. */
export function revokeAuditSession(target, token) {
  const login = AUDIT_LOGIN[target.id];
  if (login?.kind !== "session" || !token) return;
  runAuditSessionCommand(login, ["-action", "revoke", "-token", token]);
}

/**
 * Unlighthouse `authenticate` hook. Runs once; Unlighthouse copies the resulting cookies and
 * storage onto every page it scans afterwards.
 * @param {import("puppeteer-core").Page} page
 * @param {{ id: string, site: string }} target
 */
export async function authenticateAuditPage(page, target, env = process.env) {
  const login = AUDIT_LOGIN[target.id];
  if (login.kind === "session") {
    await page.setCookie({
      name: login.cookie,
      value: env[AUDIT_SESSION_TOKEN_ENV],
      domain: AUTH_COOKIE_DOMAIN,
      path: AUTH_COOKIE_PATH,
      httpOnly: true,
    });
    return;
  }

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
