import { AUDIT_FRONTENDS } from "./audit-frontends.mjs";

/** `.env` switch. Bun loads the root `.env` automatically, so `process.env` sees it. */
export const AUDIT_TEST_MODE_ENV = "AUDIT_TEST_MODE";
/** Set by the runner so the Unlighthouse config knows which app it is scanning. */
export const AUDIT_TARGET_ENV = "AUDIT_TARGET_ID";

const AUTH_SUBMIT_SELECTOR = 'button[type="submit"]';
const AUTH_EMAIL_SELECTOR = 'input[type="email"]';
const AUTH_PASSWORD_SELECTOR = 'input[type="password"]';
const AUTH_FORM_TIMEOUT_MS = 15_000;
const AUTH_NAVIGATION_TIMEOUT_MS = 30_000;
const AUTH_COOKIE_DOMAIN = "localhost";
const AUTH_COOKIE_PATH = "/";

/**
 * How each audited app signs in during test mode.
 * - `form`: email and password typed into the app's own sign-in page.
 * - `cookie`: an existing session cookie, `name=value`, read from `.env`.
 *   Used where sign-in is Google-only, so no password exists to type.
 */
export const AUDIT_LOGIN = {
  "joined-frontend": {
    kind: "form",
    signInPath: "/sign-in",
    emailEnv: "AUDIT_JOINED_EMAIL",
    passwordEnv: "AUDIT_JOINED_PASSWORD",
  },
  "connected-frontend": {
    kind: "form",
    signInPath: "/marketplace/login",
    emailEnv: "AUDIT_CONNECTED_EMAIL",
    passwordEnv: "AUDIT_CONNECTED_PASSWORD",
  },
  "scoutwell-frontend": {
    kind: "cookie",
    cookieEnv: "AUDIT_SCOUTWELL_COOKIE",
  },
  "admin-frontend": {
    kind: "cookie",
    cookieEnv: "AUDIT_ADMIN_COOKIE",
  },
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

/**
 * Fails fast, before any scan starts, when test mode is on but a target has no credentials.
 * @param {{ id: string, label: string }} target
 */
export function assertAuditCredentials(target, env = process.env) {
  const login = AUDIT_LOGIN[target.id];
  if (!login) {
    throw new Error(`No audit login configured for ${target.label} (${target.id}).`);
  }
  if (login.kind === "form") {
    const missing = [login.emailEnv, login.passwordEnv].filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(
        `Test mode is on but ${target.label} is missing ${missing.join(", ")} in .env.`,
      );
    }
    return;
  }
  if (!parseCookie(env[login.cookieEnv])) {
    throw new Error(
      `Test mode is on but ${target.label} needs ${login.cookieEnv}=name=value in .env.`,
    );
  }
}

/** @returns {{ name: string, value: string } | null} */
export function parseCookie(raw) {
  if (!raw) return null;
  const separator = raw.indexOf("=");
  if (separator <= 0) return null;
  return { name: raw.slice(0, separator).trim(), value: raw.slice(separator + 1).trim() };
}

/**
 * Unlighthouse `authenticate` hook. Runs once; Unlighthouse copies the resulting cookies and
 * storage onto every page it scans afterwards.
 * @param {import("puppeteer-core").Page} page
 * @param {{ id: string, label: string, site: string }} target
 */
export async function authenticateAuditPage(page, target, env = process.env) {
  const login = AUDIT_LOGIN[target.id];
  if (login.kind === "cookie") {
    const cookie = parseCookie(env[login.cookieEnv]);
    await page.setCookie({
      ...cookie,
      domain: AUTH_COOKIE_DOMAIN,
      path: AUTH_COOKIE_PATH,
    });
    return;
  }

  await page.goto(new URL(login.signInPath, target.site).href, {
    waitUntil: "networkidle0",
    timeout: AUTH_NAVIGATION_TIMEOUT_MS,
  });
  await page.waitForSelector(AUTH_EMAIL_SELECTOR, { timeout: AUTH_FORM_TIMEOUT_MS });
  await page.type(AUTH_EMAIL_SELECTOR, env[login.emailEnv]);
  await page.type(AUTH_PASSWORD_SELECTOR, env[login.passwordEnv]);
  await Promise.all([
    page
      .waitForNavigation({ waitUntil: "networkidle0", timeout: AUTH_NAVIGATION_TIMEOUT_MS })
      .catch(() => null),
    page.click(AUTH_SUBMIT_SELECTOR),
  ]);

  if (page.url().includes(login.signInPath)) {
    throw new Error(
      `${target.label} sign-in failed for ${env[login.emailEnv]}; still on ${login.signInPath}.`,
    );
  }
}
