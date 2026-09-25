"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  MoreMenu,
  ProgressBar,
  Icon,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Table,
  Text,
  TextInput,
  icons,
  type BadgeVariant,
  type TableColumn,
  type TableDensity,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

type Status = "Open" | "Review" | "Draft" | "Awarded";

type Room = {
  id: string;
  name: string;
  owner: string;
  bids: number;
  budget: number;
  status: Status;
  updated: string;
};

const STATUS_TONE: Record<Status, BadgeVariant> = {
  Open: "success",
  Review: "warning",
  Draft: "neutral",
  Awarded: "info",
};

const ROWS: Room[] = [
  { id: "brand", name: "Brand refresh", owner: "Sam Ortiz", bids: 6, budget: 2400, status: "Open", updated: "2h ago" },
  { id: "landing", name: "Landing page", owner: "Jordan Mills", bids: 2, budget: 1800, status: "Review", updated: "5h ago" },
  { id: "motion", name: "Motion system", owner: "Alex Kim", bids: 0, budget: 3200, status: "Draft", updated: "Yesterday" },
  { id: "deck", name: "Pitch deck", owner: "Riley Chen", bids: 11, budget: 950, status: "Awarded", updated: "Mon" },
  { id: "icons", name: "Icon set", owner: "Sam Ortiz", bids: 4, budget: 1200, status: "Open", updated: "Mon" },
  { id: "onboard", name: "Onboarding flow", owner: "Jordan Mills", bids: 8, budget: 4100, status: "Review", updated: "Sep 18" },
  { id: "email", name: "Email templates", owner: "Alex Kim", bids: 3, budget: 700, status: "Open", updated: "Sep 16" },
  { id: "docs", name: "Docs site", owner: "Riley Chen", bids: 5, budget: 2900, status: "Draft", updated: "Sep 12" },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const RICH: TableColumn<Room>[] = [
  {
    key: "name",
    header: "Room",
    sortable: true,
    render: (row) => (
      <Stack gap={0}>
        <Text weight="medium">{row.name}</Text>
        <Text type="supporting" color="secondary">
          Updated {row.updated}
        </Text>
      </Stack>
    ),
  },
  {
    key: "owner",
    header: "Owner",
    sortable: true,
    render: (row) => (
      <HStack gap={2} vAlign="center">
        <Avatar name={row.owner} size="sm" tooltip={false} />
        <span>{row.owner}</span>
      </HStack>
    ),
  },
  { key: "status", header: "Status", sortable: true, render: (row) => <Badge label={row.status} variant={STATUS_TONE[row.status]} /> },
  { key: "bids", header: "Bids", align: "end", sortable: true },
  { key: "budget", header: "Budget", align: "end", sortable: true, render: (row) => money.format(row.budget) },
];

const SIMPLE: TableColumn<Room>[] = [
  { key: "name", header: "Room" },
  { key: "owner", header: "Owner" },
  { key: "bids", header: "Bids", align: "end" },
  { key: "budget", header: "Budget", align: "end", render: (row) => money.format(row.budget) },
];

const DENSITIES = [
  { value: "compact", label: "Compact" },
  { value: "regular", label: "Regular" },
  { value: "spacious", label: "Spacious" },
];

const STATUS_FILTERS = ["All", "Open", "Review", "Draft", "Awarded"] as const;

export default function TableDemo() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [picked, setPicked] = useState<string[]>(["brand", "icons"]);
  const [single, setSingle] = useState<string[]>(["landing"]);
  const [density, setDensity] = useState<TableDensity>("regular");
  const [loading, setLoading] = useState(false);
  const [bulk, setBulk] = useState<string[]>([]);
  const [archived, setArchived] = useState<string[]>([]);
  const [detail, setDetail] = useState<Room | null>(null);
  const live = ROWS.filter((row) => !archived.includes(row.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ROWS.filter(
      (row) => (status === "All" || row.status === status) && (!q || `${row.name} ${row.owner}`.toLowerCase().includes(q))
    );
  }, [query, status]);

  return (
    <Examples>
      <Preview label="Workspace — search, filter, sort, select, page">
        <Table
          caption="Rooms"
          columns={RICH}
          rows={filtered}
          rowKey={(row) => row.id}
          selection="multiple"
          selectedKeys={picked}
          onSelectionChange={setPicked}
          defaultSort={{ key: "bids", direction: "desc" }}
          pageSize={5}
          empty={
            <Stack gap={2} hAlign="center">
              <Text weight="medium">No rooms match</Text>
              <Button label="Clear filters" variant="secondary" size="sm" onClick={() => { setQuery(""); setStatus("All"); }} />
            </Stack>
          }
          header={
            <>
              <HStack gap={3} vAlign="center" wrap="wrap">
                <Stack width={220}>
                  <TextInput
                    size="sm"
                    label="Search rooms"
                    isLabelHidden
                    placeholder="Search rooms or owners"
                    value={query}
                    onChange={setQuery}
                    startIcon={<Icon icon={icons.search} />}
                    hasClear
                  />
                </Stack>
                <SegmentedControl label="Status" size="sm" value={status} onChange={(value) => setStatus(value as typeof status)}>
                  {STATUS_FILTERS.map((s) => (
                    <SegmentedControlItem key={s} value={s} label={s} />
                  ))}
                </SegmentedControl>
              </HStack>
              <Button label={picked.length > 0 ? `Archive ${picked.length}` : "Archive"} variant="primary" size="sm" isDisabled={picked.length === 0} />
            </>
          }
        />
      </Preview>

      <Preview label="Single selection — click or press Enter on a row">
        <Stack gap={3}>
          <Table columns={SIMPLE} rows={ROWS.slice(0, 4)} rowKey={(row) => row.id} selection="single" selectedKeys={single} onSelectionChange={setSingle} />
          <Caption>{single.length ? `Selected: ${ROWS.find((r) => r.id === single[0])?.name}` : "Nothing selected"}</Caption>
        </Stack>
      </Preview>

      <Preview label="Density, stripes, and lined columns">
        <Stack gap={3} hAlign="start">
          <SegmentedControl label="Density" size="sm" value={density} onChange={(value) => setDensity(value as TableDensity)}>
            {DENSITIES.map((d) => (
              <SegmentedControlItem key={d.value} value={d.value} label={d.label} />
            ))}
          </SegmentedControl>
          <Table columns={SIMPLE} rows={ROWS.slice(0, 5)} rowKey={(row) => row.id} density={density} striped variant="lined" />
        </Stack>
      </Preview>

      <Preview label="Sticky header in a scroll area">
        <Table columns={SIMPLE} rows={ROWS} rowKey={(row) => row.id} stickyHeader maxHeight={220} defaultSort={{ key: "name", direction: "asc" }} />
      </Preview>

      <Preview label="Loading and empty">
        <Stack gap={4} hAlign="start">
          <Button label={loading ? "Show data" : "Show loading"} variant="secondary" size="sm" onClick={() => setLoading(!loading)} />
          <Table columns={SIMPLE} rows={ROWS.slice(0, 3)} rowKey={(row) => row.id} loading={loading} />
          <Table columns={SIMPLE} rows={[]} variant="plain" empty="No rooms match this filter." />
        </Stack>
      </Preview>

      <Preview label="Bulk actions — select rows, act on all of them">
        <Stack gap={3}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="semibold">{bulk.length ? `${bulk.length} selected` : `${live.length} rooms`}</Text>
            <Button label="Archive" size="sm" icon={<Icon icon={icons.folder} />} isDisabled={!bulk.length} onClick={() => { setArchived((a) => [...a, ...bulk]); setBulk([]); }} />
            <Button label="Export" size="sm" variant="ghost" icon={<Icon icon={icons.download} />} isDisabled={!bulk.length} />
            {archived.length > 0 && <Button label={`Restore ${archived.length}`} size="sm" variant="ghost" onClick={() => setArchived([])} />}
          </HStack>
          <Table columns={SIMPLE} rows={live} rowKey={(row) => row.id} selection="multiple" selectedKeys={bulk} onSelectionChange={setBulk} density="compact" />
        </Stack>
      </Preview>

      <Preview label="Rich cells — people, progress, and row menus">
        <Table
          rows={ROWS.slice(0, 5)}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "Room",
              render: (row) => (
                <Stack gap={0}>
                  <Text weight="semibold">{row.name}</Text>
                  <Text type="supporting" color="secondary">Updated {row.updated}</Text>
                </Stack>
              ),
            },
            {
              key: "owner",
              header: "Owner",
              render: (row) => (
                <HStack gap={2} vAlign="center">
                  <Avatar name={row.owner} size="sm" tooltip={false} />
                  <Text>{row.owner}</Text>
                </HStack>
              ),
            },
            { key: "bids", header: "Bids in", width: 160, render: (row) => <ProgressBar label={`${row.name} bids`} isLabelHidden value={Math.min(row.bids, 8)} max={8} variant={row.bids >= 6 ? "success" : "accent"} /> },
            { key: "actions", header: "", align: "end", width: 56, render: (row) => <MoreMenu label={`${row.name} actions`} items={[{ label: "Open" }, { label: "Duplicate" }, { type: "divider" }, { label: "Archive", variant: "destructive" }]} /> },
          ]}
        />
      </Preview>

      <Preview label="Row click opens details">
        <HStack gap={4} vAlign="start" wrap="wrap">
          <Stack width={420}>
            <Table columns={SIMPLE.slice(0, 2)} rows={ROWS.slice(0, 6)} rowKey={(row) => row.id} onRowClick={setDetail} variant="plain" />
          </Stack>
          <Card width={280}>
            {detail ? (
              <Stack gap={3}>
                <HStack hAlign="between" vAlign="center">
                  <Heading level={4}>{detail.name}</Heading>
                  <Badge label={detail.status} variant={STATUS_TONE[detail.status]} />
                </HStack>
                <MetadataList columns="single" label={{ position: "start", width: 80 }}>
                  <MetadataListItem label="Owner">{detail.owner}</MetadataListItem>
                  <MetadataListItem label="Bids">{detail.bids}</MetadataListItem>
                  <MetadataListItem label="Budget">{money.format(detail.budget)}</MetadataListItem>
                  <MetadataListItem label="Updated">{detail.updated}</MetadataListItem>
                </MetadataList>
              </Stack>
            ) : (
              <Caption>Click a row to see its details.</Caption>
            )}
          </Card>
        </HStack>
      </Preview>
    </Examples>
  );
}
