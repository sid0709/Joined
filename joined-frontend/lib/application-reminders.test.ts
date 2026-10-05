import { describe, expect, test } from "bun:test";

import type { Application } from "./applications";
import { formatTime } from "./dates";
import {
  applicationsWithReminders,
  combineDateAndTime,
  DEFAULT_REMIND_TIME,
  reminderBadge,
  reminderLabel,
  reminderStatus,
  timeFromDate,
} from "./application-reminders";

const now = new Date(2026, 9, 5, 14, 30);

function app(patch: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    columnId: "applied",
    jobId: "job-1",
    title: "Product Designer",
    company: "Acme",
    location: "Remote",
    salary: "$140k",
    source: "direct",
    resume: "General",
    match: 82,
    updated: now,
    activity: [],
    ...patch,
  };
}

describe("reminderStatus", () => {
  test("is none without a datetime, overdue when due, upcoming when later", () => {
    expect(reminderStatus(undefined, now)).toBe("none");
    expect(reminderStatus(null, now)).toBe("none");
    expect(reminderStatus(new Date(2026, 9, 5, 14, 30), now)).toBe("overdue");
    expect(reminderStatus(new Date(2026, 9, 5, 14, 29), now)).toBe("overdue");
    expect(reminderStatus(new Date(2026, 9, 5, 14, 31), now)).toBe("upcoming");
  });
});

describe("combineDateAndTime", () => {
  test("joins a calendar day with HH:mm, and rejects a missing day", () => {
    const combined = combineDateAndTime(new Date(2026, 9, 12), "15:45");
    expect(combined).toEqual(new Date(2026, 9, 12, 15, 45, 0, 0));
    expect(combineDateAndTime(null, DEFAULT_REMIND_TIME)).toBeNull();
    expect(combineDateAndTime(new Date(2026, 9, 12), "nope")).toBeNull();
  });

  test("round-trips the time fragment", () => {
    expect(timeFromDate(new Date(2026, 9, 12, 9, 5))).toBe("09:05");
    expect(timeFromDate(new Date(2026, 9, 12, 15, 0))).toBe("15:00");
  });
});

describe("reminder copy", () => {
  test("labels overdue and upcoming reminders in local time", () => {
    expect(reminderLabel(new Date(2026, 9, 4, 9, 0), now)).toBe(
      `Overdue · Yesterday · ${formatTime("09:00")}`,
    );
    expect(reminderLabel(new Date(2026, 9, 6, 15, 30), now)).toBe(
      `Remind Tomorrow · ${formatTime("15:30")}`,
    );
    expect(reminderBadge("overdue")).toEqual({ label: "Overdue", variant: "error" });
    expect(reminderBadge("upcoming")).toEqual({ label: "Reminder", variant: "warning" });
    expect(reminderBadge("none")).toBeNull();
  });
});

describe("applicationsWithReminders", () => {
  test("orders overdue oldest-first, then upcoming soonest-first", () => {
    const ordered = applicationsWithReminders(
      [
        app({ id: "soon", title: "Soon", remindAt: new Date(2026, 9, 8, 9, 0) }),
        app({ id: "none", title: "None" }),
        app({ id: "older", title: "Older", remindAt: new Date(2026, 9, 1, 9, 0) }),
        app({ id: "late", title: "Late", remindAt: new Date(2026, 9, 4, 9, 0) }),
        app({ id: "next", title: "Next", remindAt: new Date(2026, 9, 6, 9, 0) }),
      ],
      now,
    );
    expect(ordered.map((item) => item.id)).toEqual(["older", "late", "next", "soon"]);
  });
});
