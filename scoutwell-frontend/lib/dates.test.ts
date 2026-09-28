import { describe, expect, it } from "bun:test";

import { addDays, daysBetween, relativeDay, startOfDay } from "./dates";

describe("dates", () => {
  it("counts whole local days between two dates", () => {
    const from = startOfDay(new Date("2026-09-01T15:00:00"));
    const to = startOfDay(new Date("2026-09-04T08:00:00"));
    expect(daysBetween(from, to)).toBe(3);
  });

  it("describes relative days", () => {
    const now = new Date("2026-09-28T12:00:00");
    expect(relativeDay(now.toISOString(), now)).toBe("Today");
    expect(relativeDay("2026-09-27T12:00:00", now)).toBe("Yesterday");
    expect(relativeDay("2026-09-30T12:00:00", now)).toBe("In 2 days");
  });

  it("shifts an ISO timestamp by days", () => {
    expect(addDays("2026-09-01T00:00:00.000Z", 14)).toBe("2026-09-15T00:00:00.000Z");
  });
});
