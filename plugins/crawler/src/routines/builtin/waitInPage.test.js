import { describe, expect, test } from "bun:test";

import { RoutineStoppedError } from "../../routineKit/runner.js";

import { BUILTIN_WAIT_OP, WAIT_UNTIL } from "./constants.js";
import { waitInPage } from "./waitInPage.js";

const TIMEOUT_MS = 5_000;

describe("waitInPage", () => {
  test("sends one builtinWait and returns the page's answer", async () => {
    const calls = [];
    const answer = { until: WAIT_UNTIL.HEART, matched: true, found: true };
    const call = async (op, payload, waitMs) => {
      calls.push({ op, payload, waitMs });
      return answer;
    };
    await expect(waitInPage(call, WAIT_UNTIL.HEART, { jobId: "1" }, TIMEOUT_MS)).resolves.toBe(
      answer,
    );
    expect(calls).toEqual([
      {
        op: BUILTIN_WAIT_OP,
        payload: { jobId: "1", until: WAIT_UNTIL.HEART, timeoutMs: TIMEOUT_MS },
        waitMs: TIMEOUT_MS,
      },
    ]);
  });

  test("null when the page does not know the op or the document went away", async () => {
    await expect(waitInPage(async () => ({}), WAIT_UNTIL.DETAIL, {}, TIMEOUT_MS)).resolves.toBe(
      null,
    );
    const gone = async () => {
      throw new Error("The message port closed before a response was received.");
    };
    await expect(waitInPage(gone, WAIT_UNTIL.DETAIL, {}, TIMEOUT_MS)).resolves.toBe(null);
  });

  test("Stop still stops", async () => {
    const stopped = async () => {
      throw new RoutineStoppedError();
    };
    await expect(waitInPage(stopped, WAIT_UNTIL.DETAIL, {}, TIMEOUT_MS)).rejects.toBeInstanceOf(
      RoutineStoppedError,
    );
  });
});
