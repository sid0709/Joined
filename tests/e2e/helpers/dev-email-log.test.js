import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import {
  DEV_EMAIL_RESET_LINK_KEY,
  DEV_EMAIL_TO_KEY,
  DEV_EMAIL_VERIFY_LINK_KEY,
  appUrlFromLoggedLink,
  latestDevEmailLink,
  logByteCursor,
  parseDevEmailEvents,
  waitForLoggedEmailAppUrl,
} from "./dev-email-log";
import { DEFAULT_JOINED_FRONTEND_ORIGIN } from "./origins";

const VERIFY_TOKEN = "abc123token";
const RESET_TOKEN = "reset456token";
const TO = "e2e.step31@joined.test";
const DEV_EMAIL_LOG_ORIGIN = "http://localhost:3000";
const VERIFY_LINK = `${DEV_EMAIL_LOG_ORIGIN}/verify?token=${VERIFY_TOKEN}`;
const RESET_LINK = `${DEV_EMAIL_LOG_ORIGIN}/reset-password?token=${RESET_TOKEN}`;
const FRONTEND = DEFAULT_JOINED_FRONTEND_ORIGIN;

describe("parseDevEmailEvents", () => {
  test("reads slog text from DevEmailSender", () => {
    const chunk = [
      `time=2026-10-05T14:00:00.000Z level=INFO msg="Email verification" to=${TO} name=Quinn ${DEV_EMAIL_VERIFY_LINK_KEY}=${VERIFY_LINK}`,
      `time=2026-10-05T14:00:01.000Z level=INFO msg="Password reset" to=${TO} name=Quinn ${DEV_EMAIL_RESET_LINK_KEY}=${RESET_LINK}`,
    ].join("\n");
    const events = parseDevEmailEvents(chunk);
    expect(events).toEqual([
      { kind: "verification", to: TO, link: VERIFY_LINK },
      { kind: "reset", to: TO, link: RESET_LINK },
    ]);
  });

  test("reads JSON slog and strips service prefixes", () => {
    const json = JSON.stringify({
      msg: "Email verification",
      [DEV_EMAIL_TO_KEY]: "E2E.Step31@joined.test",
      [DEV_EMAIL_VERIFY_LINK_KEY]: VERIFY_LINK,
    });
    const chunk = `\u001b[34m[joined-api]\u001b[0m ${json}`;
    expect(parseDevEmailEvents(chunk)).toEqual([
      { kind: "verification", to: TO, link: VERIFY_LINK },
    ]);
  });

  test("reads stdlib slog lines from bun run dev", () => {
    const chunk = `\u001b[34m[joined-api]\u001b[0m 2026/10/05 14:36:16 INFO Email verification to=${TO} name=Quinn ${DEV_EMAIL_VERIFY_LINK_KEY}=${VERIFY_LINK}`;
    expect(parseDevEmailEvents(chunk)).toEqual([
      { kind: "verification", to: TO, link: VERIFY_LINK },
    ]);
  });

  test("parses quoted slog values", () => {
    const chunk = `msg="Email verification" to="${TO}" name="Quinn Seeker" ${DEV_EMAIL_VERIFY_LINK_KEY}="${VERIFY_LINK}"`;
    expect(parseDevEmailEvents(chunk)).toEqual([
      { kind: "verification", to: TO, link: VERIFY_LINK },
    ]);
  });

  test("ignores duplicate-signup notices and unrelated lines", () => {
    const chunk = [
      `msg="Duplicate signup attempt" to=${TO} message="Someone tried to sign up"`,
      "joined api listening addr=127.0.0.1:8080",
    ].join("\n");
    expect(parseDevEmailEvents(chunk)).toEqual([]);
  });

  test("latestDevEmailLink returns the newest match for that address", () => {
    const first = `${DEV_EMAIL_LOG_ORIGIN}/verify?token=oldtoken`;
    const second = VERIFY_LINK;
    const events = parseDevEmailEvents(
      [
        `to=other@joined.test ${DEV_EMAIL_VERIFY_LINK_KEY}=${second}`,
        `to=${TO} ${DEV_EMAIL_VERIFY_LINK_KEY}=${first}`,
        `to=${TO} ${DEV_EMAIL_VERIFY_LINK_KEY}=${second}`,
      ].join("\n"),
    );
    expect(latestDevEmailLink(events, "verification", TO)).toBe(second);
    expect(latestDevEmailLink(events, "reset", TO)).toBeUndefined();
  });
});

describe("appUrlFromLoggedLink", () => {
  test("rewrites the hardcoded log-sender host onto joined-frontend", () => {
    expect(appUrlFromLoggedLink(VERIFY_LINK, FRONTEND)).toBe(
      `${FRONTEND}/verify?token=${VERIFY_TOKEN}`,
    );
    expect(appUrlFromLoggedLink(RESET_LINK, FRONTEND)).toBe(
      `${FRONTEND}/reset-password?token=${RESET_TOKEN}`,
    );
  });
});

describe("waitForLoggedEmailAppUrl", () => {
  test("reads only new DevEmailSender lines after the log cursor", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "joined-e2e-log-"));
    const logPath = path.join(dir, "api.log");
    await writeFile(
      logPath,
      `to=other@joined.test ${DEV_EMAIL_VERIFY_LINK_KEY}=${DEV_EMAIL_LOG_ORIGIN}/verify?token=stale\n`,
    );
    const afterByte = await logByteCursor(logPath);
    const pending = waitForLoggedEmailAppUrl({
      kind: "verification",
      to: TO,
      afterByte,
      logPath,
      timeoutMs: 2_000,
      pollMs: 20,
      origin: FRONTEND,
    });
    await writeFile(
      logPath,
      `to=other@joined.test ${DEV_EMAIL_VERIFY_LINK_KEY}=${DEV_EMAIL_LOG_ORIGIN}/verify?token=stale\n` +
        `to=${TO} ${DEV_EMAIL_VERIFY_LINK_KEY}=${VERIFY_LINK}\n`,
    );
    expect(await pending).toBe(`${FRONTEND}/verify?token=${VERIFY_TOKEN}`);
  });
});
