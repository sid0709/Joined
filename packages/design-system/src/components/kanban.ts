/** Board data and the pure move logic behind KanbanBoard — usable on a server too. */

export interface KanbanColumn {
  id: string;
  title: string;
  /** Work-in-progress limit; the count turns to a warning when exceeded. */
  limit?: number;
  /** Nothing can be dropped here — a done-and-locked or archived column. */
  isLocked?: boolean;
}

export interface KanbanLane {
  id: string;
  title: string;
  subtitle?: string;
}

/** Items only need an id and a column; order within a cell is the array order. */
export interface KanbanItemBase {
  id: string;
  columnId: string;
  laneId?: string;
}

export interface KanbanSlot {
  columnId: string;
  laneId?: string;
  /** Position among the other items in that cell. */
  index: number;
}

export interface KanbanMove {
  itemId: string;
  from: KanbanSlot;
  to: KanbanSlot;
}

export function inCell<T extends KanbanItemBase>(item: T, columnId: string, laneId?: string) {
  return item.columnId === columnId && (laneId === undefined || item.laneId === laneId);
}

export function cellItems<T extends KanbanItemBase>(items: T[], columnId: string, laneId?: string) {
  return items.filter((item) => inCell(item, columnId, laneId));
}

/** Where an item sits now. */
export function slotOf<T extends KanbanItemBase>(items: T[], itemId: string): KanbanSlot | null {
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;
  const index = cellItems(items, item.columnId, item.laneId).findIndex((i) => i.id === itemId);
  return { columnId: item.columnId, laneId: item.laneId, index };
}

/**
 * Moves one item to a column (and lane) at an index among that cell's other
 * items. Returns a new array; everything else keeps its order.
 */
export function moveKanbanItem<T extends KanbanItemBase>(
  items: T[],
  itemId: string,
  to: KanbanSlot,
): T[] {
  const moving = items.find((i) => i.id === itemId);
  if (!moving) return items;
  const rest = items.filter((i) => i.id !== itemId);
  const laneId = to.laneId ?? moving.laneId;
  const moved = { ...moving, columnId: to.columnId, laneId } as T;
  const siblings = rest.filter((i) => inCell(i, to.columnId, laneId));
  const index = Math.max(0, Math.min(to.index, siblings.length));
  const anchor = siblings[index];
  if (anchor) {
    const at = rest.indexOf(anchor);
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
  }
  const last = siblings[siblings.length - 1];
  const at = last ? rest.indexOf(last) + 1 : rest.length;
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}
