import { describe, expect, test } from "bun:test";

import {
  alreadyNotified,
  notificationDedupeKey,
  planStatusNotifications,
  trimSeenKeys,
} from "./dedupe";
import type { ScoutStatusNotification, StatusPollState } from "./types";

function notice(overrides: Partial<ScoutStatusNotification> = {}): ScoutStatusNotification {
  return {
    id: "n1",
    kind: "decision",
    tone: "success",
    title: "Job approved",
    body: "Staff Engineer at Acme Labs is live in the job pool.",
    subject_id: "sub-1",
    event: "accepted",
    read: false,
    created_at: "2026-10-05T12:00:00.000Z",
    ...overrides,
  };
}

const emptyState: StatusPollState = { since: "", seenKeys: [], bootstrapped: false };

describe("notification de-dupe", () => {
  test("the same accepted status uses one key even when notification ids differ", () => {
    expect(notificationDedupeKey(notice({ id: "n1" }))).toBe("accepted:sub-1");
    expect(notificationDedupeKey(notice({ id: "n2" }))).toBe("accepted:sub-1");
    expect(notificationDedupeKey(notice({ event: "rejected", id: "n3" }))).toBe("rejected:sub-1");
    expect(notificationDedupeKey(notice({ event: "earned", id: "earn-1" }))).toBe("earned:earn-1");
    expect(notificationDedupeKey(notice({ event: undefined }))).toBe("n1");
    expect(notificationDedupeKey(notice({ event: "accepted", subject_id: undefined }))).toBe("n1");
  });

  test("bootstrap records history without notifying", () => {
    const planned = planStatusNotifications(emptyState, [
      notice(),
      notice({ id: "n2", event: "rejected", subject_id: "sub-2" }),
    ]);
    expect(planned.toNotify).toEqual([]);
    expect(planned.state.bootstrapped).toBe(true);
    expect(planned.state.since).toBe("n2");
    expect(planned.state.seenKeys).toContain("accepted:sub-1");
    expect(planned.state.seenKeys).toContain("rejected:sub-2");
  });

  test("the same status never notifies twice across polls", () => {
    const first = planStatusNotifications({ ...emptyState, bootstrapped: true }, [notice()]);
    expect(first.toNotify).toEqual([notice()]);

    const replaySameId = planStatusNotifications(first.state, [notice()]);
    expect(replaySameId.toNotify).toEqual([]);

    const replaySameStatus = planStatusNotifications(first.state, [notice({ id: "n-other" })]);
    expect(replaySameStatus.toNotify).toEqual([]);
  });

  test("the same status twice in one page notifies once", () => {
    const planned = planStatusNotifications({ ...emptyState, bootstrapped: true }, [
      notice({ id: "n1" }),
      notice({ id: "n2" }),
    ]);
    expect(planned.toNotify).toHaveLength(1);
    expect(planned.toNotify[0]?.id).toBe("n1");
  });

  test("distinct submissions and earns each notify", () => {
    const planned = planStatusNotifications({ ...emptyState, bootstrapped: true }, [
      notice({ id: "n1", subject_id: "sub-1", event: "accepted" }),
      notice({ id: "n2", subject_id: "sub-2", event: "accepted" }),
      notice({ id: "n3", subject_id: "sub-1", event: "rejected" }),
      notice({
        id: "e1",
        kind: "reward",
        event: "earned",
        title: "Approval reward",
        body: "$5 for Staff Engineer.",
      }),
      notice({
        id: "e2",
        kind: "reward",
        event: "earned",
        title: "Apply reward",
        body: "$1 for Staff Engineer.",
      }),
    ]);
    expect(planned.toNotify.map((item) => item.id)).toEqual(["n1", "n2", "n3", "e1", "e2"]);
  });

  test("published events are recorded but not notified", () => {
    const planned = planStatusNotifications({ ...emptyState, bootstrapped: true }, [
      notice({ id: "n9", event: "published" }),
    ]);
    expect(planned.toNotify).toEqual([]);
    expect(
      alreadyNotified(new Set(planned.state.seenKeys), notice({ id: "n9", event: "published" })),
    ).toBe(true);
  });

  test("trimSeenKeys keeps the newest keys when the cap is exceeded", () => {
    expect(trimSeenKeys(["a", "b", "c"], 2)).toEqual(["b", "c"]);
    expect(trimSeenKeys(["a", "b"], 2)).toEqual(["a", "b"]);
  });
});
