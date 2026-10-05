import { readFile, stat } from "node:fs/promises";

import { JOINED_BACKEND_LOG_ENV, JOINED_BACKEND_LOG_PATH, JOINED_FRONTEND_ORIGIN } from "./origins";
import { AUTH_PATHS, AUTH_TOKEN_PARAM } from "./routes";
import { EMAIL_LOG_POLL_MS, EMAIL_LOG_TIMEOUT_MS } from "./timeouts";

/** slog attr names from `auth.DevEmailSender`. */
export const DEV_EMAIL_TO_KEY = "to";
export const DEV_EMAIL_VERIFY_LINK_KEY = "verificationLink";
export const DEV_EMAIL_RESET_LINK_KEY = "resetLink";

export type DevEmailKind = "verification" | "reset";

export type DevEmailEvent = {
  kind: DevEmailKind;
  to: string;
  link: string;
};

const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g;
const SERVICE_PREFIX = /^\[[^\]]+]\s+/;
const JSON_OBJECT_PREFIX = "{";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function stripLogDecorations(line: string): string {
  return line.replace(ANSI_ESCAPE, "").replace(SERVICE_PREFIX, "").trim();
}

function unescapeSlog(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function slogAttr(line: string, key: string): string | undefined {
  const quoted = line.match(new RegExp(`(?:^|\\s)${key}="((?:\\\\.|[^"\\\\])*)"`));
  if (quoted?.[1] !== undefined) return unescapeSlog(quoted[1]);
  const bare = line.match(new RegExp(`(?:^|\\s)${key}=(\\S+)`));
  return bare?.[1];
}

function kindFromLinkKeys(
  verificationLink: string | undefined,
  resetLink: string | undefined,
): { kind: DevEmailKind; link: string } | undefined {
  if (verificationLink) return { kind: "verification", link: verificationLink };
  if (resetLink) return { kind: "reset", link: resetLink };
  return undefined;
}

function eventFromRecord(record: Record<string, unknown>): DevEmailEvent | undefined {
  const to = typeof record[DEV_EMAIL_TO_KEY] === "string" ? record[DEV_EMAIL_TO_KEY] : "";
  const verificationLink =
    typeof record[DEV_EMAIL_VERIFY_LINK_KEY] === "string"
      ? record[DEV_EMAIL_VERIFY_LINK_KEY]
      : undefined;
  const resetLink =
    typeof record[DEV_EMAIL_RESET_LINK_KEY] === "string"
      ? record[DEV_EMAIL_RESET_LINK_KEY]
      : undefined;
  const found = kindFromLinkKeys(verificationLink, resetLink);
  if (!to || !found) return undefined;
  return { kind: found.kind, to: normalizeEmail(to), link: found.link };
}

function parseJsonEvent(line: string): DevEmailEvent | undefined {
  if (!line.startsWith(JSON_OBJECT_PREFIX)) return undefined;
  try {
    return eventFromRecord(JSON.parse(line) as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

function parseTextEvent(line: string): DevEmailEvent | undefined {
  const to = slogAttr(line, DEV_EMAIL_TO_KEY);
  const found = kindFromLinkKeys(
    slogAttr(line, DEV_EMAIL_VERIFY_LINK_KEY),
    slogAttr(line, DEV_EMAIL_RESET_LINK_KEY),
  );
  if (!to || !found) return undefined;
  return { kind: found.kind, to: normalizeEmail(to), link: found.link };
}

/** Parse DevEmailSender slog lines from a backend log chunk. */
export function parseDevEmailEvents(chunk: string): DevEmailEvent[] {
  const events: DevEmailEvent[] = [];
  for (const raw of chunk.split(/\r?\n/)) {
    const line = stripLogDecorations(raw);
    if (!line) continue;
    const event = parseJsonEvent(line) ?? parseTextEvent(line);
    if (event) events.push(event);
  }
  return events;
}

export function latestDevEmailLink(
  events: DevEmailEvent[],
  kind: DevEmailKind,
  to: string,
): string | undefined {
  const needle = normalizeEmail(to);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind === kind && event.to === needle) return event.link;
  }
  return undefined;
}

/** Map a logged verify/reset URL onto the running joined-frontend origin. */
export function appUrlFromLoggedLink(
  loggedLink: string,
  origin: string = JOINED_FRONTEND_ORIGIN,
): string {
  const url = new URL(loggedLink);
  const token = url.searchParams.get(AUTH_TOKEN_PARAM)?.trim() ?? "";
  if (!token) {
    throw new Error(`logged email link is missing ${AUTH_TOKEN_PARAM}: ${loggedLink}`);
  }
  const path =
    url.pathname === AUTH_PATHS.resetPassword ? AUTH_PATHS.resetPassword : AUTH_PATHS.verify;
  return `${origin}${path}?${AUTH_TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

export async function logByteCursor(logPath: string = JOINED_BACKEND_LOG_PATH): Promise<number> {
  try {
    const info = await stat(logPath);
    return info.size;
  } catch {
    return 0;
  }
}

async function readLogSince(logPath: string, afterByte: number): Promise<string> {
  try {
    const body = await readFile(logPath);
    if (afterByte <= 0) return body.toString("utf8");
    if (afterByte >= body.length) return "";
    return body.subarray(afterByte).toString("utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return "";
    throw error;
  }
}

function missingLinkError(kind: DevEmailKind, to: string, logPath: string): Error {
  return new Error(
    `No ${kind} link for ${to} in ${logPath}. The journey reads auth.DevEmailSender slog (` +
      `${DEV_EMAIL_VERIFY_LINK_KEY} / ${DEV_EMAIL_RESET_LINK_KEY}); tee joined-api output to ` +
      `${JOINED_BACKEND_LOG_ENV} (default ${JOINED_BACKEND_LOG_PATH}). See tests/e2e/README.md.`,
  );
}

/**
 * Wait for the log email sender to print a verify or reset URL for `to`.
 * Only bytes after `afterByte` are considered, so parallel journeys stay isolated.
 */
export async function waitForLoggedEmailAppUrl(options: {
  kind: DevEmailKind;
  to: string;
  afterByte: number;
  logPath?: string;
  timeoutMs?: number;
  pollMs?: number;
  origin?: string;
}): Promise<string> {
  const logPath = options.logPath ?? JOINED_BACKEND_LOG_PATH;
  const timeoutMs = options.timeoutMs ?? EMAIL_LOG_TIMEOUT_MS;
  const pollMs = options.pollMs ?? EMAIL_LOG_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const chunk = await readLogSince(logPath, options.afterByte);
    const logged = latestDevEmailLink(parseDevEmailEvents(chunk), options.kind, options.to);
    if (logged) return appUrlFromLoggedLink(logged, options.origin ?? JOINED_FRONTEND_ORIGIN);
    await delay(pollMs);
  }
  throw missingLinkError(options.kind, options.to, logPath);
}
