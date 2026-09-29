"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Badge } from "./Feedback";
import { icons } from "./Glyph";
import {
  cellItems,
  moveKanbanItem,
  slotOf,
  type KanbanColumn,
  type KanbanItemBase,
  type KanbanLane,
  type KanbanMove,
  type KanbanSlot,
} from "./kanban";
import { ScrollableArea } from "./LayoutPrimitives";
import { VisuallyHidden } from "./Lists";
import { Card, HStack, Heading, Icon, Stack, Text } from "./Primitives";

export interface KanbanItemState {
  /** Being dragged with the pointer. */
  isDragging: boolean;
  /** Picked up with the keyboard (Space) and moving with the arrow keys. */
  isGrabbed: boolean;
}

export interface KanbanBoardProps<T extends KanbanItemBase> {
  /** Names the board for assistive tech. */
  label: string;
  columns: KanbanColumn[];
  /** Every item on the board; order within a column is array order. */
  items: T[];
  onItemsChange: (items: T[], move: KanbanMove) => void;
  renderItem: (item: T, state: KanbanItemState) => ReactNode;
  /** Short name for announcements, e.g. the ticket key and title. */
  getItemLabel: (item: T) => string;
  /** Rows across the board — by assignee, epic, or priority. */
  lanes?: KanbanLane[];
  /** Veto a drop, e.g. only QA can move to Done. */
  canDrop?: (item: T, to: Omit<KanbanSlot, "index">) => boolean;
  /** Extra actions in each column header. */
  renderColumnActions?: (column: KanbanColumn) => ReactNode;
  /** Content under each cell's cards — an "Add card" button. */
  renderCellFooter?: (column: KanbanColumn, laneId?: string) => ReactNode;
  /** Shown in an empty cell. */
  emptyText?: string;
  columnWidth?: number;
  /** Caps each cell's height and scrolls its cards. */
  maxCellHeight?: number;
  isDisabled?: boolean;
}

type Target = { columnId: string; laneId?: string; index: number; allowed: boolean };

const COLUMN_WIDTH = 280;
const MIN_CELL_HEIGHT = 72;
const DRAGGING_OPACITY = 0.4;
const KEY_HINT =
  "Press Space to pick up. Arrow keys move — Left and Right between columns, Up and Down within one, Shift with Up and Down between lanes. Space drops, Escape cancels.";

/**
 * A Jira-style board. Drag cards between columns and lanes with the pointer,
 * or pick one up with Space and move it with the arrow keys. Columns show
 * counts and WIP limits; lanes group rows by anything you like.
 */
export function KanbanBoard<T extends KanbanItemBase>({
  label,
  columns,
  items,
  onItemsChange,
  renderItem,
  getItemLabel,
  lanes,
  canDrop,
  renderColumnActions,
  renderCellFooter,
  emptyText = "Drop cards here",
  columnWidth = COLUMN_WIDTH,
  maxCellHeight,
  isDisabled = false,
}: KanbanBoardProps<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragHeight, setDragHeight] = useState(0);
  const [target, setTarget] = useState<Target | null>(null);
  const [grabbed, setGrabbed] = useState<{ id: string; origin: KanbanSlot } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const nodes = useRef(new Map<string, HTMLElement>());
  // Read synchronously in dragover/drop, which can fire before React re-renders.
  const dragging = useRef<string | null>(null);
  const refocus = useRef<string | null>(null);
  const hintId = `${label.replace(/\s+/g, "-").toLowerCase()}-kanban-hint`;

  const laneIds: (string | undefined)[] = lanes?.length ? lanes.map((l) => l.id) : [undefined];
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const titleOf = (columnId: string, laneId?: string) =>
    [columnById.get(columnId)?.title, lanes?.find((l) => l.id === laneId)?.title]
      .filter(Boolean)
      .join(", ");

  // Keep keyboard focus on a card after it moves to another column (it remounts).
  useEffect(() => {
    if (!refocus.current) return;
    nodes.current.get(refocus.current)?.focus();
    refocus.current = null;
  });

  const allowed = (item: T, columnId: string, laneId?: string) =>
    !columnById.get(columnId)?.isLocked && (canDrop ? canDrop(item, { columnId, laneId }) : true);

  const commit = (itemId: string, to: KanbanSlot, focus = false) => {
    const from = slotOf(items, itemId);
    if (!from) return;
    const next = moveKanbanItem(items, itemId, to);
    const landed = slotOf(next, itemId) ?? to;
    if (focus) refocus.current = itemId;
    onItemsChange(next, { itemId, from, to: landed });
    return landed;
  };

  const reset = () => {
    dragging.current = null;
    setDragId(null);
    setTarget(null);
  };

  // ---- pointer drag and drop ----
  const onCardDragStart = (event: DragEvent<HTMLElement>, item: T) => {
    if (isDisabled) return;
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
    setDragHeight(event.currentTarget.offsetHeight);
    dragging.current = item.id;
    setDragId(item.id);
    setAnnouncement(`Picked up ${getItemLabel(item)}.`);
  };

  const onCellDragOver = (event: DragEvent<HTMLElement>, columnId: string, laneId?: string) => {
    const id = dragging.current;
    if (!id) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const ok = allowed(item, columnId, laneId);
    if (ok) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
    const cards: HTMLElement[] = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "[data-kanban-card]",
      ) as ArrayLike<HTMLElement>,
    ).filter((el) => el.dataset.kanbanCard !== id);
    const index = cards.findIndex((el) => {
      const box = el.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });
    const next = { columnId, laneId, index: index === -1 ? cards.length : index, allowed: ok };
    if (
      !target ||
      target.columnId !== next.columnId ||
      target.laneId !== next.laneId ||
      target.index !== next.index ||
      target.allowed !== next.allowed
    )
      setTarget(next);
  };

  const onCellDrop = (event: DragEvent<HTMLElement>, columnId: string, laneId?: string) => {
    event.preventDefault();
    const id = dragging.current;
    const item = id ? items.find((i) => i.id === id) : undefined;
    // Fall back to the end of the cell if no dragover landed a target yet.
    const slot =
      target && target.columnId === columnId && target.laneId === laneId
        ? target
        : {
            columnId,
            laneId,
            index: cellItems(items, columnId, laneId).length,
            allowed: item ? allowed(item, columnId, laneId) : false,
          };
    if (id && item && slot.allowed) {
      const landed = commit(id, slot);
      if (item && landed)
        setAnnouncement(
          `Moved ${getItemLabel(item)} to ${titleOf(landed.columnId, landed.laneId)}, position ${landed.index + 1}.`,
        );
    }
    reset();
  };

  // ---- keyboard move ----
  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, item: T) => {
    if (isDisabled || event.target !== event.currentTarget) return;
    const name = getItemLabel(item);
    const here = slotOf(items, item.id);
    if (!here) return;

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (grabbed?.id === item.id) {
        setGrabbed(null);
        setAnnouncement(
          `Dropped ${name} in ${titleOf(here.columnId, here.laneId)}, position ${here.index + 1}.`,
        );
      } else {
        setGrabbed({ id: item.id, origin: here });
        setAnnouncement(`Picked up ${name}. ${KEY_HINT}`);
      }
      return;
    }
    if (grabbed?.id !== item.id) return;

    if (event.key === "Escape") {
      event.preventDefault();
      commit(item.id, grabbed.origin, true);
      setGrabbed(null);
      setAnnouncement(
        `Cancelled. ${name} is back in ${titleOf(grabbed.origin.columnId, grabbed.origin.laneId)}.`,
      );
      return;
    }

    const colIndex = columns.findIndex((c) => c.id === here.columnId);
    const laneIndex = laneIds.indexOf(here.laneId);
    let to: KanbanSlot | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const step = event.key === "ArrowLeft" ? -1 : 1;
      for (let c = colIndex + step; c >= 0 && c < columns.length; c += step) {
        if (allowed(item, columns[c].id, here.laneId)) {
          to = { columnId: columns[c].id, laneId: here.laneId, index: here.index };
          break;
        }
      }
    } else if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      event.shiftKey &&
      lanes?.length
    ) {
      const nextLane = laneIds[laneIndex + (event.key === "ArrowUp" ? -1 : 1)];
      if (nextLane !== undefined && allowed(item, here.columnId, nextLane))
        to = { columnId: here.columnId, laneId: nextLane, index: here.index };
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const size = cellItems(items, here.columnId, here.laneId).length;
      const index = here.index + (event.key === "ArrowUp" ? -1 : 1);
      if (index >= 0 && index < size) to = { ...here, index };
    }
    if (!to) return;
    event.preventDefault();
    const landed = commit(item.id, to, true);
    if (landed)
      setAnnouncement(
        `${name}: ${titleOf(landed.columnId, landed.laneId)}, position ${landed.index + 1}.`,
      );
  };

  // ---- rendering ----
  const renderCell = (column: KanbanColumn, laneId?: string) => {
    const cards = cellItems(items, column.id, laneId);
    const isTarget = dragId !== null && target?.columnId === column.id && target?.laneId === laneId;
    const blocked = isTarget && !target?.allowed;
    const placeholder = (
      <Card key="kanban-placeholder" variant="blue" height={dragHeight} padding={0} />
    );
    const visible = cards.filter((c) => c.id !== dragId);

    let list: ReactNode[] = cards.map((item) => {
      const isDragging = item.id === dragId;
      const node = (
        <div
          key={item.id}
          ref={(el) => {
            if (el) nodes.current.set(item.id, el);
            else nodes.current.delete(item.id);
          }}
          data-kanban-card={item.id}
          draggable={!isDisabled}
          tabIndex={isDisabled ? undefined : 0}
          role="listitem"
          aria-roledescription="draggable card"
          aria-describedby={hintId}
          aria-label={getItemLabel(item)}
          onDragStart={(e) => onCardDragStart(e, item)}
          onDragEnd={reset}
          onKeyDown={(e) => onCardKeyDown(e, item)}
          onBlur={() => grabbed?.id === item.id && refocus.current !== item.id && setGrabbed(null)}
          style={isDragging ? { opacity: DRAGGING_OPACITY } : undefined}
        >
          {renderItem(item, { isDragging, isGrabbed: grabbed?.id === item.id })}
        </div>
      );
      return node;
    });

    if (isTarget && target?.allowed) {
      const anchor = visible[target.index];
      const at = anchor
        ? list.findIndex((n) => (n as { key?: string }).key === anchor.id)
        : list.length;
      list = [...list.slice(0, at), placeholder, ...list.slice(at)];
    }

    return (
      <Card
        key={`${column.id}:${laneId ?? ""}`}
        className="os-kanban-cell"
        data-kanban-column={column.id}
        variant={blocked ? "red" : "muted"}
        padding={2}
        width={columnWidth}
        minHeight={MIN_CELL_HEIGHT}
      >
        <div
          role="list"
          aria-label={titleOf(column.id, laneId)}
          onDragOver={(e) => onCellDragOver(e, column.id, laneId)}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTarget(null);
          }}
          onDrop={(e) => onCellDrop(e, column.id, laneId)}
        >
          <Stack
            gap={2}
            minHeight={MIN_CELL_HEIGHT - 16}
            isScrollable={maxCellHeight !== undefined}
            height={maxCellHeight}
          >
            {list}
            {cards.length === 0 && !isTarget && (
              <Stack hAlign="center" gap={1} paddingBlock={3}>
                <Text type="supporting" color="secondary">
                  {column.isLocked ? "Locked" : emptyText}
                </Text>
              </Stack>
            )}
            {blocked && (
              <HStack gap={1} vAlign="center" hAlign="center">
                <Icon icon={icons.lock} size="sm" color="error" />
                <Text type="supporting" color="secondary">
                  Can’t move here
                </Text>
              </HStack>
            )}
            {renderCellFooter?.(column, laneId)}
          </Stack>
        </div>
      </Card>
    );
  };

  const header = (
    <HStack gap={3} wrap="nowrap">
      {columns.map((column) => {
        const count = items.filter((i) => i.columnId === column.id).length;
        const over = column.limit !== undefined && count > column.limit;
        return (
          <HStack
            key={column.id}
            width={columnWidth}
            gap={2}
            vAlign="center"
            hAlign="between"
            paddingInline={2}
          >
            <HStack gap={2} vAlign="center">
              {column.isLocked && <Icon icon={icons.lock} size="sm" color="secondary" />}
              <Text weight="semibold">{column.title}</Text>
              <Badge
                label={column.limit !== undefined ? `${count}/${column.limit}` : count}
                variant={over ? "warning" : "neutral"}
              />
            </HStack>
            {renderColumnActions?.(column)}
          </HStack>
        );
      })}
    </HStack>
  );

  return (
    <ScrollableArea label={label} axis="inline">
      <VisuallyHidden>
        <span id={hintId}>{KEY_HINT}</span>
        <span aria-live="polite">{announcement}</span>
      </VisuallyHidden>
      <Stack gap={3} paddingBlockEnd={2}>
        {header}
        {laneIds.map((laneId) => {
          const lane = lanes?.find((l) => l.id === laneId);
          const count =
            laneId === undefined ? items.length : items.filter((i) => i.laneId === laneId).length;
          return (
            <Stack key={laneId ?? "board"} gap={2}>
              {lane && (
                <HStack gap={2} vAlign="center" paddingInline={2}>
                  <Heading level={5}>{lane.title}</Heading>
                  {lane.subtitle && (
                    <Text type="supporting" color="secondary">
                      {lane.subtitle}
                    </Text>
                  )}
                  <Badge label={count} />
                </HStack>
              )}
              <HStack gap={3} wrap="nowrap" vAlign="stretch" className="os-kanban-row">
                {columns.map((column) => renderCell(column, laneId))}
              </HStack>
            </Stack>
          );
        })}
      </Stack>
    </ScrollableArea>
  );
}
