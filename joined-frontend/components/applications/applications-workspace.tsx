"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Badge,
  Button,
  HStack,
  Icon,
  KanbanBoard,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Tab,
  TabList,
  TextInput,
  icons,
  useToast,
} from "sid-ui";
import { StatGrid } from "@/components/stat-card";
import {
  applyApplicationExtras,
  extrasFromPatch,
  getApplicationExtrasServerSnapshot,
  getApplicationExtrasSnapshot,
  migrateApplicationExtras,
  parseApplicationExtras,
  pruneApplicationExtras,
  readApplicationExtras,
  subscribeApplicationExtras,
  upsertApplicationExtras,
} from "@/lib/application-extras";
import {
  BOARD_COLUMNS,
  STAGE_BY_ID,
  STAGES,
  applicationStats,
  canMoveToStage,
  savedBoardJobId,
  type Application,
  type ApplicationStage,
} from "@/lib/applications";
import { toApplicationPatch } from "@/lib/application-patch";
import {
  createApplication,
  fetchApplications,
  removeApplication,
  updateApplication,
} from "@/lib/me/pipeline";
import { AddApplicationDialog } from "./add-application-dialog";
import { ApplicationCard } from "./application-card";
import { ApplicationDrawer } from "./application-drawer";
import { ApplicationList } from "./application-list";
import { ApplicationReminderBanners } from "./application-reminder-banners";

type View = "board" | "list";
type StageFilter = ApplicationStage | "all";

const COLUMN_WIDTH = 260;
const SEARCH_WIDTH = 280;

function matches(application: Application, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    application.title,
    application.company,
    application.location,
    application.notes ?? "",
  ].some((field) => field.toLowerCase().includes(needle));
}

/** The application tracker: stats, a board or table, and a detail drawer. */
export function ApplicationsWorkspace({
  initial,
  userId,
}: {
  initial: Application[];
  userId: string;
}) {
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const extrasJson = useSyncExternalStore(
    subscribeApplicationExtras,
    () => getApplicationExtrasSnapshot(userId),
    getApplicationExtrasServerSnapshot,
  );
  const extras = useMemo(() => parseApplicationExtras(extrasJson), [extrasJson]);
  const board = useMemo(() => applyApplicationExtras(items, extras), [items, extras]);
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const replace = (next: Application) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  };

  const reload = async () => {
    const next = await fetchApplications();
    setItems(next.applications);
  };

  const stats = applicationStats(board);
  const visible = useMemo(() => board.filter((item) => matches(item, query)), [board, query]);
  const listed = stage === "all" ? visible : visible.filter((item) => item.columnId === stage);
  const open = board.find((item) => item.id === openId) ?? null;

  const persistStage = async (id: string, to: ApplicationStage) => {
    const current = board.find((item) => item.id === id);
    if (current && !canMoveToStage(current, to)) {
      toast({
        body: "Saved is for jobs you bookmarked. Unsave the job instead of moving an application there.",
        type: "error",
      });
      await reload();
      return;
    }
    if (to === "saved") return;
    try {
      const next = await updateApplication(id, { columnId: to });
      const fromId = id;
      if (fromId !== next.id) migrateApplicationExtras(userId, fromId, next.id);
      const merged = applyApplicationExtras([next], readApplicationExtras(userId))[0] ?? next;
      setItems((current) =>
        current.filter((item) => item.id !== fromId && item.id !== next.id).concat(merged),
      );
      if (openId === fromId) setOpenId(next.id);
      toast({ body: `Moved to ${STAGE_BY_ID[to].title}` });
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "Could not move the application.",
        type: "error",
      });
      await reload();
    }
  };

  const moveTo = (id: string, to: ApplicationStage) => {
    void persistStage(id, to);
  };

  const persistFollowUp = async (id: string, patch: { notes?: string; remindAt?: Date | null }) => {
    upsertApplicationExtras(userId, id, extrasFromPatch(patch));
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch, updated: new Date() } : item)),
    );
    if (savedBoardJobId(id)) return;
    try {
      const next = await updateApplication(id, toApplicationPatch(patch));
      replace(
        applyApplicationExtras([next], readApplicationExtras(userId))[0] ?? { ...next, ...patch },
      );
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "Could not save the follow-up.",
        type: "error",
      });
    }
  };

  const remove = async (id: string) => {
    try {
      await removeApplication(id);
      pruneApplicationExtras(userId, id);
      setItems((current) => current.filter((item) => item.id !== id));
      setOpenId(null);
      toast({ body: "Removed from your tracker" });
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "Could not remove the application.",
        type: "error",
      });
    }
  };

  return (
    <Stack gap={6}>
      <StatGrid
        stats={[
          {
            label: "Saved",
            value: String(stats.saved),
            hint: "Bookmarked, not applied yet",
          },
          {
            label: "Active",
            value: String(stats.active),
            hint: `${stats.responseRate}% heard back · ${stats.sent} sent`,
          },
          {
            label: "Interviewing",
            value: String(stats.interviewing),
            hint: "With rounds on the calendar",
          },
          {
            label: "Offers",
            value: String(stats.offers),
            accessory:
              stats.offers > 0 ? <Badge label="Respond soon" variant="success" /> : undefined,
            hint: "Waiting on your reply",
          },
        ]}
      />

      <ApplicationReminderBanners applications={visible} onOpen={(row) => setOpenId(row.id)} />

      <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
        <HStack gap={3} vAlign="center" wrap="wrap">
          <SegmentedControl label="View" value={view} onChange={(value) => setView(value as View)}>
            <SegmentedControlItem value="board" label="Board" icon={<Icon icon={icons.grid} />} />
            <SegmentedControlItem value="list" label="List" icon={<Icon icon={icons.list} />} />
          </SegmentedControl>
          <TextInput
            label="Search applications"
            isLabelHidden
            placeholder="Search role, company, city, or notes"
            startIcon={<Icon icon={icons.search} />}
            value={query}
            onChange={setQuery}
            hasClear
            width={SEARCH_WIDTH}
          />
        </HStack>
        <Button
          label="Track an application"
          variant="primary"
          icon={<Icon icon={icons.plus} />}
          onClick={() => setIsAdding(true)}
        />
      </HStack>

      {view === "board" ? (
        <KanbanBoard
          label="Applications by stage"
          columns={BOARD_COLUMNS}
          items={visible}
          onItemsChange={(next, move) => {
            const others = items.filter((item) => !visible.some((shown) => shown.id === item.id));
            setItems([
              ...others,
              ...next.map((item) =>
                item.id === move.itemId ? { ...item, updated: new Date() } : item,
              ),
            ]);
            if (move.from.columnId !== move.to.columnId) {
              void persistStage(move.itemId, move.to.columnId as ApplicationStage);
            }
          }}
          getItemLabel={(item) => `${item.title} at ${item.company}`}
          renderItem={(item) => (
            <ApplicationCard application={item} onOpen={() => setOpenId(item.id)} />
          )}
          columnWidth={COLUMN_WIDTH}
          emptyText="Nothing in this stage"
        />
      ) : (
        <Stack gap={4}>
          <TabList
            value={stage}
            onChange={(value) => setStage(value as StageFilter)}
            hasDivider
            overflow="scroll"
          >
            <Tab
              value="all"
              label="All"
              endContent={<Badge label={String(visible.length)} variant="neutral" />}
            />
            {STAGES.map((meta) => (
              <Tab
                key={meta.id}
                value={meta.id}
                label={meta.title}
                endContent={
                  <Badge
                    label={String(visible.filter((item) => item.columnId === meta.id).length)}
                    variant="neutral"
                  />
                }
              />
            ))}
          </TabList>
          <ApplicationList rows={listed} onOpen={(row) => setOpenId(row.id)} />
        </Stack>
      )}

      <ApplicationDrawer
        application={open}
        onClose={() => setOpenId(null)}
        onStageChange={moveTo}
        onFollowUp={(id, patch) => void persistFollowUp(id, patch)}
        onRemove={(id) => void remove(id)}
      />
      <AddApplicationDialog
        isOpen={isAdding}
        onOpenChange={setIsAdding}
        onAdd={async (draft) => {
          try {
            const application = await createApplication({
              title: draft.title,
              company: draft.company,
              location: draft.location,
              columnId: draft.columnId,
            });
            setItems((current) => [
              applyApplicationExtras([application], extras)[0] ?? application,
              ...current,
            ]);
            toast({ body: `Tracking ${application.title} at ${application.company}` });
          } catch (error) {
            toast({
              body: error instanceof Error ? error.message : "Could not track the application.",
              type: "error",
            });
            throw error;
          }
        }}
      />
    </Stack>
  );
}
