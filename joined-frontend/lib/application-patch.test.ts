import { describe, expect, test } from "bun:test";

import { toApplicationPatch } from "./application-patch";

describe("toApplicationPatch", () => {
  test("omits unset fields and serializes remindAt as ISO or null", () => {
    expect(toApplicationPatch({ columnId: "interview" })).toEqual({ columnId: "interview" });
    expect(toApplicationPatch({ closedReason: "Withdrawn", nextStep: "Reply Friday" })).toEqual({
      closedReason: "Withdrawn",
      nextStep: "Reply Friday",
    });
    expect(toApplicationPatch({ notes: "Call Maya", remindAt: null })).toEqual({
      notes: "Call Maya",
      remindAt: null,
    });
    expect(toApplicationPatch({ remindAt: new Date("2026-10-12T15:00:00.000Z") }).remindAt).toBe(
      "2026-10-12T15:00:00.000Z",
    );
  });
});
