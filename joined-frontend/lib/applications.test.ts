import { describe, expect, test } from "bun:test";

import {
  ADD_STAGES,
  BOARD_COLUMNS,
  MAX_APPLICATION_NOTES,
  PIPELINE_STAGES,
  STAGES,
  applicationStats,
  canMoveToStage,
  clipNotes,
  hydrateApplication,
  isSavedBoardItem,
  parseOptionalJSONDate,
  savedBoardJobId,
  stageSelectorOptions,
  type Application,
} from "./applications";

const updated = new Date("2026-10-05T14:30:00.000Z");

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
    updated,
    activity: [],
    ...patch,
  };
}

describe("saved board ids", () => {
  test("strips the saved: prefix used by GET /v1/me/applications", () => {
    expect(savedBoardJobId("saved:job-9")).toBe("job-9");
    expect(savedBoardJobId("app-1")).toBeNull();
  });

  test("treats prefix or Saved column as a bookmark, not an application", () => {
    expect(isSavedBoardItem(app({ id: "saved:job-9", columnId: "saved" }))).toBe(true);
    expect(isSavedBoardItem(app({ columnId: "saved" }))).toBe(true);
    expect(isSavedBoardItem(app())).toBe(false);
  });

  test("blocks moving a real application onto Saved", () => {
    expect(canMoveToStage(app(), "saved")).toBe(false);
    expect(canMoveToStage(app({ id: "saved:job-9", columnId: "saved" }), "saved")).toBe(true);
    expect(canMoveToStage(app({ id: "saved:job-9", columnId: "saved" }), "applied")).toBe(true);
  });
});

describe("stages", () => {
  test("keeps Saved first on the board, then the pipeline, then Closed", () => {
    expect(STAGES.map((stage) => stage.id)).toEqual([
      "saved",
      "applied",
      "screening",
      "interview",
      "offer",
      "closed",
    ]);
    expect(BOARD_COLUMNS.map((column) => column.id)).toEqual(STAGES.map((stage) => stage.id));
    expect(ADD_STAGES).toEqual(PIPELINE_STAGES);
    expect(ADD_STAGES.includes("saved")).toBe(false);
  });

  test("hides Saved on the stage selector unless the card is a bookmark", () => {
    expect(stageSelectorOptions(app()).map((option) => option.value)).not.toContain("saved");
    expect(
      stageSelectorOptions(app({ id: "saved:job-9", columnId: "saved" })).map(
        (option) => option.value,
      ),
    ).toContain("saved");
  });
});

describe("hydrateApplication", () => {
  test("parses activity, updated, notes, and remindAt from JSON", () => {
    const hydrated = hydrateApplication({
      ...app(),
      updated: "2026-10-05T14:30:00.000Z",
      notes: "Follow up with Maya",
      remindAt: "2026-10-12T15:00:00.000Z",
      activity: [{ id: "e1", label: "Applied", date: "2026-10-01T12:00:00.000Z" }],
    });
    expect(hydrated.updated.toISOString()).toBe("2026-10-05T14:30:00.000Z");
    expect(hydrated.notes).toBe("Follow up with Maya");
    expect(hydrated.remindAt?.toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(hydrated.activity[0]?.date.toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  test("treats a null remindAt as cleared and clips long notes", () => {
    const hydrated = hydrateApplication({
      ...app(),
      updated: updated.toISOString(),
      notes: "x".repeat(MAX_APPLICATION_NOTES + 12),
      remindAt: null,
    });
    expect(hydrated.notes).toHaveLength(MAX_APPLICATION_NOTES);
    expect(hydrated.remindAt).toBeNull();
  });
});

describe("parseOptionalJSONDate", () => {
  test("keeps missing, null, and invalid values distinct", () => {
    expect(parseOptionalJSONDate(undefined)).toBeUndefined();
    expect(parseOptionalJSONDate(null)).toBeNull();
    expect(parseOptionalJSONDate("")).toBeNull();
    expect(parseOptionalJSONDate("not a date")).toBeNull();
    expect(parseOptionalJSONDate("2026-10-05T09:00:00.000Z")?.toISOString()).toBe(
      "2026-10-05T09:00:00.000Z",
    );
  });
});

describe("clipNotes", () => {
  test("caps private notes at the tracker limit", () => {
    expect(clipNotes("short")).toBe("short");
    expect(clipNotes("n".repeat(MAX_APPLICATION_NOTES + 1))).toHaveLength(MAX_APPLICATION_NOTES);
  });
});

describe("applicationStats", () => {
  test("counts Saved separately from sent applications", () => {
    const stats = applicationStats([
      app({ id: "s1", columnId: "saved" }),
      app({ id: "a1", columnId: "applied" }),
      app({ id: "i1", columnId: "interview" }),
      app({ id: "o1", columnId: "offer" }),
    ]);
    expect(stats.saved).toBe(1);
    expect(stats.sent).toBe(3);
    expect(stats.active).toBe(3);
    expect(stats.interviewing).toBe(1);
    expect(stats.offers).toBe(1);
    expect(stats.responseRate).toBe(67);
  });

  test("splits reminders into overdue and upcoming", () => {
    const now = new Date("2026-10-05T12:00:00");
    const stats = applicationStats(
      [
        app({ id: "late", remindAt: new Date("2026-10-04T09:00:00") }),
        app({ id: "soon", remindAt: new Date("2026-10-06T09:00:00") }),
        app({ id: "none" }),
      ],
      now,
    );
    expect(stats.overdueReminders).toBe(1);
    expect(stats.upcomingReminders).toBe(1);
  });
});
