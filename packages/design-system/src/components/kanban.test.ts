import { describe, expect, it } from "bun:test";

import { cellItems, inCell, moveKanbanItem, slotOf, type KanbanItemBase } from "./kanban";

const items: KanbanItemBase[] = [
  { id: "a", columnId: "todo", laneId: "one" },
  { id: "b", columnId: "todo", laneId: "one" },
  { id: "c", columnId: "doing", laneId: "one" },
  { id: "d", columnId: "todo", laneId: "two" },
];

describe("Kanban helpers", () => {
  it("matches cells with optional lanes", () => {
    expect(inCell(items[0], "todo")).toBe(true);
    expect(inCell(items[0], "todo", "one")).toBe(true);
    expect(inCell(items[0], "todo", "two")).toBe(false);
    expect(cellItems(items, "todo")).toHaveLength(3);
    expect(cellItems(items, "todo", "one").map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("finds an item's ordered slot and handles missing ids", () => {
    expect(slotOf(items, "b")).toEqual({ columnId: "todo", laneId: "one", index: 1 });
    expect(slotOf(items, "missing")).toBeNull();
  });

  it("returns the original list when the item does not exist", () => {
    expect(moveKanbanItem(items, "missing", { columnId: "done", index: 0 })).toBe(items);
  });

  it("reorders within a cell and clamps requested indexes", () => {
    expect(
      moveKanbanItem(items, "b", { columnId: "todo", laneId: "one", index: 0 }).map(({ id }) => id),
    ).toEqual(["b", "a", "c", "d"]);
    expect(
      moveKanbanItem(items, "a", { columnId: "todo", laneId: "one", index: 99 }).map(
        ({ id }) => id,
      ),
    ).toEqual(["b", "a", "c", "d"]);
    expect(
      moveKanbanItem(items, "b", { columnId: "todo", laneId: "one", index: -1 }).map(
        ({ id }) => id,
      )[0],
    ).toBe("b");
  });

  it("moves between columns and preserves or changes the lane", () => {
    const movedWithLane = moveKanbanItem(items, "a", { columnId: "done", index: 0 });
    expect(movedWithLane.find(({ id }) => id === "a")).toEqual({
      id: "a",
      columnId: "done",
      laneId: "one",
    });

    const movedToLane = moveKanbanItem(items, "a", { columnId: "doing", laneId: "two", index: 0 });
    expect(movedToLane.find(({ id }) => id === "a")).toEqual({
      id: "a",
      columnId: "doing",
      laneId: "two",
    });
  });
});
