"use client";

import { useMemo, useState } from "react";
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
} from "@openseat/design-system";
import { StatGrid } from "@/components/stat-card";
import {
  APPLICATIONS,
  BOARD_COLUMNS,
  STAGE_BY_ID,
  STAGES,
  applicationStats,
  type Application,
  type ApplicationStage,
} from "@/lib/applications";
import { AddApplicationDialog } from "./add-application-dialog";
import { ApplicationCard } from "./application-card";
import { ApplicationDrawer } from "./application-drawer";
import { ApplicationList } from "./application-list";

type View = "board" | "list";
type StageFilter = ApplicationStage | "all";

const COLUMN_WIDTH = 260;
const SEARCH_WIDTH = 280;

function matches(application: Application, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [application.title, application.company, application.location].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

/** The application tracker: stats, a board or table, and a detail drawer. */
export function ApplicationsWorkspace() {
  const toast = useToast();
  const [items, setItems] = useState(APPLICATIONS);
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const stats = applicationStats(items);
  const visible = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);
  const listed = stage === "all" ? visible : visible.filter((item) => item.columnId === stage);
  const open = items.find((item) => item.id === openId) ?? null;

  const moveTo = (id: string, to: ApplicationStage) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, columnId: to, updated: new Date() } : item,
      ),
    );
    toast({ body: `Moved to ${STAGE_BY_ID[to].title}` });
  };

  const remove = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setOpenId(null);
    toast({ body: "Removed from your tracker" });
  };

  return (
    <Stack gap={6}>
      <StatGrid
        stats={[
          { label: "Active", value: String(stats.active), hint: `${stats.sent} sent in total` },
          {
            label: "Response rate",
            value: `${stats.responseRate}%`,
            hint: "Companies that replied",
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

      <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
        <HStack gap={3} vAlign="center" wrap="wrap">
          <SegmentedControl label="View" value={view} onChange={(value) => setView(value as View)}>
            <SegmentedControlItem value="board" label="Board" icon={<Icon icon={icons.grid} />} />
            <SegmentedControlItem value="list" label="List" icon={<Icon icon={icons.list} />} />
          </SegmentedControl>
          <TextInput
            label="Search applications"
            isLabelHidden
            placeholder="Search role, company, or city"
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
              toast({
                body: `Moved to ${STAGE_BY_ID[move.to.columnId as ApplicationStage].title}`,
              });
            }
          }}
          getItemLabel={(item) => `${item.title} at ${item.company}`}
          renderItem={(item) => (
            <ApplicationCard application={item} onOpen={() => setOpenId(item.id)} />
          )}
          columnWidth={COLUMN_WIDTH}
          emptyText="Drop an application here"
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
        onRemove={remove}
      />
      <AddApplicationDialog
        isOpen={isAdding}
        onOpenChange={setIsAdding}
        onAdd={(application) => {
          setItems((current) => [application, ...current]);
          toast({ body: `Tracking ${application.title} at ${application.company}` });
        }}
      />
    </Stack>
  );
}
