import { describe, expect, test } from "bun:test";

import { TAB_GROUP_BY_ROUTINE, groupBoundTab, tabGroupSpec, ungroupBoundTab } from "./tabGroup.js";

function groupIo({ existing = [], created = 44 } = {}) {
  const grouped = [];
  const updated = [];
  return {
    grouped,
    updated,
    tabs: {
      group: async (props) => {
        grouped.push(props);
        return Number.isFinite(props.groupId) ? props.groupId : created;
      },
    },
    tabGroups: {
      query: async (info) => existing.filter((group) => group.title === info.title),
      update: async (groupId, props) => {
        updated.push({ groupId, props });
      },
    },
  };
}

describe("routine tab groups", () => {
  test("names a Chrome tab group per routine", () => {
    expect(tabGroupSpec("hiringcafe")).toEqual(TAB_GROUP_BY_ROUTINE.hiringcafe);
    expect(tabGroupSpec("builtin")).toEqual(TAB_GROUP_BY_ROUTINE.builtin);
    expect(tabGroupSpec("jobright")).toEqual(TAB_GROUP_BY_ROUTINE.jobright);
    expect(tabGroupSpec("other")).toEqual({ title: "other", color: "grey" });
  });

  test("reuses an existing group in the bound window", async () => {
    const io = groupIo({ existing: [{ id: 7, title: "HiringCafe" }] });
    await expect(groupBoundTab({ id: 11, windowId: 3 }, "hiringcafe", io)).resolves.toBe(7);
    expect(io.grouped).toEqual([{ tabIds: [11], groupId: 7 }]);
    expect(io.updated).toEqual([
      { groupId: 7, props: { title: "HiringCafe", color: "blue", collapsed: false } },
    ]);
  });

  test("creates a named group when the window has none", async () => {
    const io = groupIo({ existing: [] });
    await expect(groupBoundTab({ id: 12, windowId: 4 }, "builtin", io)).resolves.toBe(44);
    expect(io.grouped).toEqual([{ tabIds: [12], createProperties: { windowId: 4 } }]);
    expect(io.updated[0]).toMatchObject({
      groupId: 44,
      props: { title: "Built In", color: "pink" },
    });
  });

  test("skips grouping when tabs.group is unavailable", async () => {
    await expect(groupBoundTab({ id: 1, windowId: 1 }, "jobright", {})).resolves.toBeNull();
    await expect(
      groupBoundTab({}, "hiringcafe", { tabs: { group: async () => 1 } }),
    ).resolves.toBeNull();
  });

  test("creates a group when tabGroups.query throws", async () => {
    const io = groupIo({ created: 15 });
    io.tabGroups.query = async () => {
      throw new Error("query denied");
    };
    await expect(groupBoundTab({ id: 6, windowId: 2 }, "jobright", io)).resolves.toBe(15);
    expect(io.grouped).toEqual([{ tabIds: [6], createProperties: { windowId: 2 } }]);
  });

  test("ungroups the bound tab when the run ends", async () => {
    const ungrouped = [];
    const io = {
      tabs: {
        ungroup: async (tabId) => {
          ungrouped.push(tabId);
        },
      },
    };
    await expect(ungroupBoundTab(21, io)).resolves.toEqual({ ungrouped: true });
    expect(ungrouped).toEqual([21]);
    await expect(ungroupBoundTab(21, {})).resolves.toEqual({ ungrouped: false });
  });

  test("uses chrome.tabs.group when io is omitted", async () => {
    const grouped = [];
    globalThis.chrome = {
      tabs: {
        group: async (props) => {
          grouped.push(props);
          return 3;
        },
      },
      tabGroups: {
        query: async () => [],
        update: async () => {},
      },
    };
    try {
      await expect(groupBoundTab({ id: 2, windowId: 1 }, "jobright")).resolves.toBe(3);
      expect(grouped).toEqual([{ tabIds: [2], createProperties: { windowId: 1 } }]);
    } finally {
      delete globalThis.chrome;
    }
  });
});
