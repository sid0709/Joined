import { describe, expect, test } from "bun:test";

import { loadFixtureDocument } from "../capture/load-fixture";
import { RUNTIME_MESSAGE } from "../messaging/runtime";
import { answerCaptureRequest, bindCaptureListener, CAPTURE_BOUND_FLAG } from "./capture";

describe("content capture", () => {
  test("answers capture-job messages from the page document", () => {
    const root = loadFixtureDocument("greenhouse.html");
    const ignored = answerCaptureRequest(
      { type: "other" },
      root,
      "https://boards.greenhouse.io/acme/jobs/123",
    );
    const answered = answerCaptureRequest(
      { type: RUNTIME_MESSAGE.CAPTURE_JOB },
      root,
      "https://boards.greenhouse.io/acme/jobs/123",
    );
    expect(ignored).toBeNull();
    expect(answered?.job?.title).toBe("Staff Software Engineer");
  });

  test("binds a one-shot runtime listener", () => {
    const messages: unknown[] = [];
    const windowLike: Record<string, unknown> = {};
    const runtime = {
      onMessage: {
        addListener(
          listener: (
            message: unknown,
            sender: unknown,
            sendResponse: (value: unknown) => void,
          ) => void,
        ) {
          listener({ type: RUNTIME_MESSAGE.CAPTURE_JOB }, {}, (value) => messages.push(value));
        },
      },
    };
    const bound = bindCaptureListener({
      window: windowLike,
      chrome: { runtime } as Pick<typeof chrome, "runtime">,
      document: loadFixtureDocument("lever.html"),
      location: { href: "https://jobs.lever.co/acme/abc-def" },
    });
    const skipped = bindCaptureListener({ window: windowLike });
    expect(bound).toBe(true);
    expect(skipped).toBe(false);
    expect(windowLike[CAPTURE_BOUND_FLAG]).toBe(true);
    expect((messages[0] as { job: { title: string } }).job.title).toBe("Staff Software Engineer");
    expect(bindCaptureListener({ window: {} })).toBe(false);
  });
});
