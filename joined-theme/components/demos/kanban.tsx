"use client";

import {
  Avatar,
  AvatarGroup,
  AvatarStatusDot,
  Badge,
  Button,
  Card,
  CheckboxInput,
  Drawer,
  HStack,
  Heading,
  Icon,
  IconButton,
  KanbanBoard,
  Kbd,
  MetadataList,
  MetadataListItem,
  MoreMenu,
  ProgressBar,
  Selector,
  Stack,
  Switch,
  Text,
  TextInput,
  cellItems,
  icons,
  moveKanbanItem,
  type BadgeVariant,
  type KanbanColumn,
  type KanbanItemState,
  type KanbanLane,
  type KanbanMove,
} from "@joined/design-system";
import { useMemo, useState } from "react";

import { Caption, Examples, PEOPLE, Preview } from "./shared";

// ---------- Sprint board data ----------

type IssueType = "story" | "bug" | "task";
type Priority = "Highest" | "High" | "Medium" | "Low";
type Issue = {
  id: string;
  columnId: string;
  laneId?: string;
  key: string;
  title: string;
  type: IssueType;
  priority: Priority;
  points: number;
  assignee: string;
  epic: string;
};

const SPRINT_COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "To do" },
  { id: "progress", title: "In progress", limit: 3 },
  { id: "review", title: "In review", limit: 2 },
  { id: "done", title: "Done" },
];

const TYPE_ICON: Record<
  IssueType,
  { icon: Parameters<typeof Icon>[0]["icon"]; color: "success" | "error" | "accent"; label: string }
> = {
  story: { icon: icons.bookmark, color: "success", label: "Story" },
  bug: { icon: "error", color: "error", label: "Bug" },
  task: { icon: icons.check, color: "accent", label: "Task" },
};
const PRIORITY: Record<Priority, BadgeVariant> = {
  Highest: "error",
  High: "orange",
  Medium: "yellow",
  Low: "neutral",
};
const EPIC: Record<string, BadgeVariant> = {
  Bidding: "purple",
  Payments: "teal",
  Onboarding: "blue",
};

const TEAM = PEOPLE.slice(0, 4).map((p) => p.name);
const ISSUES: Issue[] = [
  {
    id: "1",
    columnId: "todo",
    key: "OS-101",
    title: "Sealed bid reveal animation",
    type: "story",
    priority: "Medium",
    points: 3,
    assignee: TEAM[0],
    epic: "Bidding",
  },
  {
    id: "2",
    columnId: "todo",
    key: "OS-102",
    title: "Escrow refund edge case",
    type: "bug",
    priority: "Highest",
    points: 2,
    assignee: TEAM[1],
    epic: "Payments",
  },
  {
    id: "3",
    columnId: "todo",
    key: "OS-103",
    title: "Invite by CSV",
    type: "story",
    priority: "Low",
    points: 5,
    assignee: TEAM[2],
    epic: "Onboarding",
  },
  {
    id: "4",
    columnId: "progress",
    key: "OS-097",
    title: "Bid comparison table",
    type: "story",
    priority: "High",
    points: 8,
    assignee: TEAM[0],
    epic: "Bidding",
  },
  {
    id: "5",
    columnId: "progress",
    key: "OS-098",
    title: "Payout webhooks retry",
    type: "task",
    priority: "Medium",
    points: 3,
    assignee: TEAM[3],
    epic: "Payments",
  },
  {
    id: "6",
    columnId: "progress",
    key: "OS-099",
    title: "Deadline timezone off by one",
    type: "bug",
    priority: "High",
    points: 1,
    assignee: TEAM[1],
    epic: "Bidding",
  },
  {
    id: "7",
    columnId: "review",
    key: "OS-094",
    title: "Welcome checklist",
    type: "story",
    priority: "Medium",
    points: 3,
    assignee: TEAM[2],
    epic: "Onboarding",
  },
  {
    id: "8",
    columnId: "done",
    key: "OS-090",
    title: "Room templates",
    type: "story",
    priority: "Medium",
    points: 5,
    assignee: TEAM[3],
    epic: "Onboarding",
  },
  {
    id: "9",
    columnId: "done",
    key: "OS-091",
    title: "Stripe Connect onboarding",
    type: "task",
    priority: "High",
    points: 5,
    assignee: TEAM[0],
    epic: "Payments",
  },
];

function IssueCard({
  issue,
  state,
  onOpen,
}: {
  issue: Issue;
  state: KanbanItemState;
  onOpen?: (issue: Issue) => void;
}) {
  const type = TYPE_ICON[issue.type];
  return (
    <Card
      padding={3}
      variant={state.isGrabbed ? "blue" : "default"}
      elevation={state.isGrabbed ? "med" : "low"}
    >
      <Stack gap={2}>
        <HStack gap={2} vAlign="start" hAlign="between">
          <Text weight="medium" maxLines={2}>
            {issue.title}
          </Text>
          {onOpen && (
            <IconButton
              label={`Open ${issue.key}`}
              variant="ghost"
              size="sm"
              icon={<Icon icon={icons.eye} />}
              onClick={() => onOpen(issue)}
            />
          )}
        </HStack>
        <HStack gap={1} wrap="wrap">
          <Badge label={issue.epic} variant={EPIC[issue.epic]} />
          <Badge label={issue.priority} variant={PRIORITY[issue.priority]} />
        </HStack>
        <HStack hAlign="between" vAlign="center">
          <HStack gap={1} vAlign="center">
            <Icon icon={type.icon} color={type.color} size="sm" label={type.label} />
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {issue.key}
            </Text>
          </HStack>
          <HStack gap={2} vAlign="center">
            <Badge label={issue.points} />
            <Avatar name={issue.assignee} size="xsm" />
          </HStack>
        </HStack>
      </Stack>
    </Card>
  );
}

/** Apply a move made on a filtered board to the full list, keeping hidden items where they are. */
function applyFiltered(all: Issue[], visible: Issue[], move: KanbanMove) {
  const target = cellItems(visible, move.to.columnId, move.to.laneId).filter(
    (i) => i.id !== move.itemId,
  );
  const anchor = target[move.to.index];
  const full = cellItems(all, move.to.columnId, move.to.laneId).filter((i) => i.id !== move.itemId);
  const index = anchor ? full.indexOf(anchor) : full.length;
  return moveKanbanItem(all, move.itemId, { ...move.to, index });
}

// ---------- Bid pipeline data ----------

type Bid = {
  id: string;
  columnId: string;
  name: string;
  role: string;
  price: number;
  days: number;
};
const PIPELINE: KanbanColumn[] = [
  { id: "invited", title: "Invited" },
  { id: "submitted", title: "Bid submitted" },
  { id: "shortlist", title: "Shortlisted", limit: 3 },
  { id: "awarded", title: "Awarded", limit: 1 },
  { id: "declined", title: "Declined", isLocked: true },
];
const BIDS: Bid[] = PEOPLE.map((p, i) => ({
  id: p.name,
  columnId: ["invited", "submitted", "submitted", "shortlist", "invited", "submitted", "declined"][
    i
  ],
  name: p.name,
  role: p.role,
  price: 1800 + i * 275,
  days: 7 + i * 2,
}));
const STAGE_ORDER = PIPELINE.map((c) => c.id);

// ---------- Personal board data ----------

type Todo = { id: string; columnId: string; title: string; done: boolean };
const PERSONAL: KanbanColumn[] = [
  { id: "today", title: "Today" },
  { id: "week", title: "This week" },
  { id: "later", title: "Later" },
];

export default function KanbanDemo() {
  const [issues, setIssues] = useState(ISSUES);
  const [query, setQuery] = useState("");
  const [who, setWho] = useState<string[]>([]);
  const [onlyBugs, setOnlyBugs] = useState(false);
  const [open, setOpen] = useState<Issue | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const [laneIssues, setLaneIssues] = useState<Issue[]>(() =>
    ISSUES.map((i) => ({ ...i, laneId: i.assignee })),
  );
  const [bids, setBids] = useState(BIDS);
  const [todos, setTodos] = useState<Todo[]>([
    { id: "a", columnId: "today", title: "Review Dana’s bid", done: false },
    { id: "b", columnId: "today", title: "Answer budget question", done: true },
    { id: "c", columnId: "week", title: "Draft award note", done: false },
    { id: "d", columnId: "later", title: "Archive old rooms", done: false },
  ]);
  const [draft, setDraft] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter(
      (i) =>
        (!q || `${i.key} ${i.title}`.toLowerCase().includes(q)) &&
        (!who.length || who.includes(i.assignee)) &&
        (!onlyBugs || i.type === "bug"),
    );
  }, [issues, query, who, onlyBugs]);

  const points = issues.reduce((sum, i) => sum + i.points, 0);
  const donePoints = issues
    .filter((i) => i.columnId === "done")
    .reduce((sum, i) => sum + i.points, 0);
  const lanes: KanbanLane[] = TEAM.map((name) => ({
    id: name,
    title: name,
    subtitle: PEOPLE.find((p) => p.name === name)?.role,
  }));
  const awarded = bids.filter((b) => b.columnId === "awarded").length;

  const addIssue = (columnId: string) =>
    setIssues((all) => [
      ...all,
      {
        id: `new-${all.length + 1}`,
        columnId,
        key: `OS-${110 + all.length}`,
        title: "New issue",
        type: "task",
        priority: "Medium",
        points: 1,
        assignee: TEAM[0],
        epic: "Bidding",
      },
    ]);

  return (
    <Examples>
      <Preview
        label="Sprint board"
        description="Drag issues between columns, or focus one and press Space, then the arrow keys. WIP limits warn when a column is over."
      >
        <Stack gap={4}>
          <HStack gap={4} vAlign="center" wrap="wrap" hAlign="between">
            <Stack gap={1}>
              <Heading level={3}>Sprint 14</Heading>
              <Text type="supporting" color="secondary">
                Sep 22 – Oct 3 · {issues.length} issues
              </Text>
            </Stack>
            <Stack width={260}>
              <ProgressBar
                label="Sprint points done"
                value={donePoints}
                max={points}
                hasValueLabel
                formatValueLabel={(v, m) => `${v} of ${m} points`}
                variant="success"
              />
            </Stack>
          </HStack>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Stack width={240}>
              <TextInput
                label="Search issues"
                isLabelHidden
                size="sm"
                placeholder="Search issues"
                value={query}
                onChange={setQuery}
                startIcon={<Icon icon={icons.search} />}
                hasClear
              />
            </Stack>
            <AvatarGroup size="sm">
              {TEAM.map((name) => (
                <Avatar
                  key={name}
                  name={name}
                  onClick={() =>
                    setWho((w) => (w.includes(name) ? w.filter((x) => x !== name) : [...w, name]))
                  }
                  status={
                    who.includes(name) ? (
                      <AvatarStatusDot variant="success" label="Filtering" />
                    ) : undefined
                  }
                />
              ))}
            </AvatarGroup>
            {who.length > 0 && (
              <Button
                label={`Clear ${who.length} people`}
                size="sm"
                variant="ghost"
                onClick={() => setWho([])}
              />
            )}
            <Switch label="Only bugs" size="sm" value={onlyBugs} onChange={setOnlyBugs} />
          </HStack>
          <KanbanBoard
            label="Sprint 14 board"
            columns={SPRINT_COLUMNS}
            items={visible}
            getItemLabel={(i) => `${i.key} ${i.title}`}
            onItemsChange={(next, move) => {
              setIssues((all) => applyFiltered(all, visible, move));
              const issue = next.find((i) => i.id === move.itemId);
              if (move.from.columnId !== move.to.columnId && issue)
                setLog((l) =>
                  [
                    `${issue.key} → ${SPRINT_COLUMNS.find((c) => c.id === move.to.columnId)?.title}`,
                    ...l,
                  ].slice(0, 4),
                );
            }}
            renderItem={(issue, state) => (
              <IssueCard issue={issue} state={state} onOpen={setOpen} />
            )}
            renderColumnActions={(column) =>
              column.id === "done" ? undefined : (
                <IconButton
                  label={`Add to ${column.title}`}
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={icons.plus} />}
                  onClick={() => addIssue(column.id)}
                />
              )
            }
            renderCellFooter={(column) =>
              column.id === "todo" ? (
                <Button
                  label="Create issue"
                  size="sm"
                  variant="ghost"
                  icon={<Icon icon={icons.plus} />}
                  onClick={() => addIssue("todo")}
                />
              ) : undefined
            }
          />
          <Caption>{log.length ? log.join(" · ") : "Moves between columns show up here."}</Caption>
        </Stack>
        <Drawer
          isOpen={open !== null}
          onOpenChange={(o) => !o && setOpen(null)}
          title={open ? `${open.key} · ${open.title}` : ""}
          subtitle={
            open
              ? SPRINT_COLUMNS.find((c) => c.id === issues.find((i) => i.id === open.id)?.columnId)
                  ?.title
              : undefined
          }
          headerActions={
            <MoreMenu
              label="Issue actions"
              items={[
                { label: "Copy link" },
                { label: "Clone" },
                { type: "divider" },
                { label: "Delete", variant: "destructive" },
              ]}
            />
          }
          footer={
            <HStack hAlign="end">
              <Button label="Done" variant="primary" onClick={() => setOpen(null)} />
            </HStack>
          }
        >
          {open && (
            <Stack gap={4}>
              <Selector
                label="Status"
                value={issues.find((i) => i.id === open.id)?.columnId ?? open.columnId}
                onChange={(columnId) =>
                  setIssues((all) =>
                    moveKanbanItem(all, open.id, {
                      columnId,
                      index: cellItems(all, columnId).length,
                    }),
                  )
                }
                options={SPRINT_COLUMNS.map((c) => ({ value: c.id, label: c.title }))}
              />
              <MetadataList columns="single" label={{ position: "start", width: 100 }}>
                <MetadataListItem label="Type">
                  <HStack gap={1} vAlign="center">
                    <Icon
                      icon={TYPE_ICON[open.type].icon}
                      color={TYPE_ICON[open.type].color}
                      size="sm"
                    />
                    <Text>{TYPE_ICON[open.type].label}</Text>
                  </HStack>
                </MetadataListItem>
                <MetadataListItem label="Assignee">
                  <HStack gap={2} vAlign="center">
                    <Avatar name={open.assignee} size="xsm" tooltip={false} />
                    <Text>{open.assignee}</Text>
                  </HStack>
                </MetadataListItem>
                <MetadataListItem label="Priority">
                  <Badge label={open.priority} variant={PRIORITY[open.priority]} />
                </MetadataListItem>
                <MetadataListItem label="Epic">
                  <Badge label={open.epic} variant={EPIC[open.epic]} />
                </MetadataListItem>
                <MetadataListItem label="Points">{open.points}</MetadataListItem>
              </MetadataList>
            </Stack>
          )}
        </Drawer>
      </Preview>

      <Preview
        label="Swimlanes"
        description="One row per assignee. Drag across lanes to reassign, or press Shift with Up and Down while a card is picked up."
      >
        <KanbanBoard
          label="Sprint 14 by assignee"
          columns={SPRINT_COLUMNS}
          lanes={lanes}
          items={laneIssues}
          getItemLabel={(i) => `${i.key} ${i.title}`}
          onItemsChange={(next) =>
            setLaneIssues(next.map((i) => ({ ...i, assignee: i.laneId ?? i.assignee })))
          }
          renderItem={(issue, state) => <IssueCard issue={issue} state={state} />}
          columnWidth={240}
          emptyText="—"
        />
      </Preview>

      <Preview
        label="Bid pipeline with rules"
        description="canDrop enforces the flow: no going back to Invited, one award only, and Declined is locked."
      >
        <Stack gap={3}>
          <KanbanBoard
            label="Brand refresh bids"
            columns={PIPELINE}
            items={bids}
            getItemLabel={(b) => `${b.name}, $${b.price}`}
            onItemsChange={setBids}
            canDrop={(bid, to) => {
              if (to.columnId === "invited" && bid.columnId !== "invited") return false;
              if (to.columnId === "awarded" && bid.columnId !== "awarded" && awarded >= 1)
                return false;
              return STAGE_ORDER.indexOf(to.columnId) >= 0;
            }}
            renderItem={(bid, state) => (
              <Card
                padding={3}
                variant={
                  bid.columnId === "awarded" ? "green" : state.isGrabbed ? "blue" : "default"
                }
              >
                <HStack gap={2} vAlign="center" hAlign="between">
                  <HStack gap={2} vAlign="center">
                    <Avatar name={bid.name} size="sm" tooltip={false} />
                    <Stack gap={0}>
                      <Text weight="semibold">{bid.name}</Text>
                      <Text type="supporting" color="secondary">
                        {bid.role}
                      </Text>
                    </Stack>
                  </HStack>
                  {bid.columnId !== "invited" && (
                    <Stack gap={0} hAlign="end">
                      <Text hasTabularNumbers>${bid.price.toLocaleString()}</Text>
                      <Caption>{bid.days} days</Caption>
                    </Stack>
                  )}
                </HStack>
              </Card>
            )}
            columnWidth={230}
          />
          <Caption>
            {awarded
              ? `Awarded to ${bids.find((b) => b.columnId === "awarded")?.name}.`
              : "Drag a bid into Awarded — only one fits."}
          </Caption>
        </Stack>
      </Preview>

      <Preview
        label="Personal board"
        description="Compact cards with checkboxes and a quick-add field — a to-do list with columns."
      >
        <Stack gap={3}>
          <HStack gap={2} vAlign="end">
            <Stack width={280}>
              <TextInput
                label="Add a task to Today"
                value={draft}
                onChange={setDraft}
                placeholder="Type and press Enter"
                onEnter={() => {
                  if (!draft.trim()) return;
                  setTodos((t) => [
                    {
                      id: `t-${t.length + 1}-${draft}`,
                      columnId: "today",
                      title: draft.trim(),
                      done: false,
                    },
                    ...t,
                  ]);
                  setDraft("");
                }}
              />
            </Stack>
            <Text type="supporting" color="secondary">
              Keyboard: focus a card, press Space, then <Kbd keys="left" /> <Kbd keys="right" />{" "}
              <Kbd keys="up" /> <Kbd keys="down" />
            </Text>
          </HStack>
          <KanbanBoard
            label="My tasks"
            columns={PERSONAL}
            items={todos}
            getItemLabel={(t) => t.title}
            onItemsChange={setTodos}
            columnWidth={240}
            renderItem={(todo, state) => (
              <Card padding={2} variant={state.isGrabbed ? "blue" : "default"}>
                <CheckboxInput
                  label={todo.title}
                  value={todo.done}
                  onChange={(done) =>
                    setTodos((all) => all.map((t) => (t.id === todo.id ? { ...t, done } : t)))
                  }
                />
              </Card>
            )}
          />
        </Stack>
      </Preview>

      <Preview
        label="Read-only"
        description="isDisabled freezes a closed sprint — cards stay readable but can’t move."
      >
        <KanbanBoard
          label="Sprint 13 (closed)"
          isDisabled
          columns={SPRINT_COLUMNS}
          items={ISSUES.map((i) => ({ ...i, columnId: "done" }))}
          getItemLabel={(i) => i.key}
          onItemsChange={() => undefined}
          renderItem={(issue, state) => <IssueCard issue={issue} state={state} />}
          columnWidth={220}
          maxCellHeight={260}
        />
      </Preview>
    </Examples>
  );
}
