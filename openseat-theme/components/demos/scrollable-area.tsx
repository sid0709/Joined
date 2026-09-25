"use client";

import {
  AspectRatio,
  Card,
  Divider,
  HStack,
  ResponsiveFrame,
  ScrollableArea,
  Stack,
  Table,
  Text,
  Tile,
  type TableColumn,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const ACTIVITY = Array.from({ length: 24 }, (_, i) => ({
  id: String(i),
  who: ["Jordan", "Alex", "Riley", "Sam"][i % 4],
  what: ["placed a bid", "left a note", "viewed the brief", "updated a bid"][i % 4],
  when: `${i + 1}m ago`,
}));

const ROOMS = ["Brand refresh", "Landing page", "Motion system", "Pitch deck", "Icon set", "Onboarding", "Email kit", "Docs site", "Illustrations"];

type Row = { id: string; room: string; q1: number; q2: number; q3: number; q4: number; total: number; owner: string; status: string };
const WIDE: Row[] = ROOMS.map((room, i) => {
  const q = [3 + i, 5 + (i % 3), 2 + i, 6 + (i % 4)];
  return { id: room, room, q1: q[0], q2: q[1], q3: q[2], q4: q[3], total: q.reduce((a, b) => a + b, 0), owner: ["Sam", "Jordan", "Alex"][i % 3], status: ["Open", "Review", "Draft"][i % 3] };
});
const WIDE_COLUMNS: TableColumn<Row>[] = [
  { key: "room", header: "Room", width: 180 },
  { key: "owner", header: "Owner", width: 120 },
  { key: "status", header: "Status", width: 120 },
  { key: "q1", header: "Q1 bids", align: "end", width: 110 },
  { key: "q2", header: "Q2 bids", align: "end", width: 110 },
  { key: "q3", header: "Q3 bids", align: "end", width: 110 },
  { key: "q4", header: "Q4 bids", align: "end", width: 110 },
  { key: "total", header: "Total", align: "end", width: 110 },
];

export default function ScrollableAreaDemo() {
  return (
    <Examples>
      <Preview label="Vertical" description="A fixed-height region scrolls on its own; the page doesn't.">
        <Card padding={0} width="100%">
          <ScrollableArea label="Activity" axis="block" height={220} padding={3}>
            <Stack gap={2}>
              {ACTIVITY.map((row) => (
                <HStack key={row.id} hAlign="between">
                  <Text>
                    <strong>{row.who}</strong> {row.what}
                  </Text>
                  <Text type="supporting" color="secondary">
                    {row.when}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </ScrollableArea>
        </Card>
      </Preview>

      <Preview label="Horizontal" description="A card rail that scrolls sideways — swipe on touch, shift-scroll on desktop.">
        <ScrollableArea label="Rooms" axis="inline" padding={1}>
          <HStack gap={3}>
            {ROOMS.map((name) => (
              <Stack key={name} width={180} gap={1}>
                <AspectRatio ratio={4 / 3}>
                  <Tile tone="neutral">Cover</Tile>
                </AspectRatio>
                <Text weight="medium">{name}</Text>
              </Stack>
            ))}
          </HStack>
        </ScrollableArea>
      </Preview>

      <Preview label="Responsive wide table" description="On narrow frames the table scrolls sideways inside its region instead of breaking the page.">
        <ResponsiveFrame defaultPreset="Phone">
          <ScrollableArea label="Quarterly bids" axis="inline">
            <Stack width={980}>
              <Table columns={WIDE_COLUMNS} rows={WIDE} rowKey={(row) => row.id} density="compact" />
            </Stack>
          </ScrollableArea>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Both axes" description="Canvases and big grids scroll in two directions.">
        <Card padding={0} width="100%">
          <ScrollableArea label="Seating map" axis="both" height={220}>
            <Stack width={900} padding={3} gap={2}>
              {Array.from({ length: 10 }, (_, row) => (
                <HStack key={row} gap={2}>
                  {Array.from({ length: 12 }, (_, seat) => (
                    <Stack key={seat} width={64}>
                      <Tile tone={(row + seat) % 5 === 0 ? "strong" : "neutral"}>
                        {String.fromCharCode(65 + row)}
                        {seat + 1}
                      </Tile>
                    </Stack>
                  ))}
                </HStack>
              ))}
            </Stack>
          </ScrollableArea>
        </Card>
      </Preview>

      <Preview label="Overscroll containment" description="contain stops a nested scroll from dragging the page once it hits the end.">
        <HStack gap={4} wrap="wrap">
          {(["allow", "contain"] as const).map((overscroll) => (
            <Stack key={overscroll} gap={1} width={260}>
              <Card padding={0}>
                <ScrollableArea label={`overscroll ${overscroll}`} axis="block" overscroll={overscroll} height={140} padding={3}>
                  <Stack gap={2}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <Tile key={i} tone="neutral">
                        Item {i + 1}
                      </Tile>
                    ))}
                  </Stack>
                </ScrollableArea>
              </Card>
              <Caption>overscroll “{overscroll}”</Caption>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview label="Pattern — fixed header and footer" description="Only the middle scrolls; the title and actions stay in view.">
        <Card padding={0} width="100%">
          <Stack gap={0}>
            <Stack padding={3}>
              <Text weight="semibold">Notifications</Text>
            </Stack>
            <Divider />
            <ScrollableArea label="Notifications" axis="block" height={180} padding={3}>
              <Stack gap={2}>
                {ACTIVITY.map((row) => (
                  <Text key={row.id}>
                    <strong>{row.who}</strong> {row.what} · {row.when}
                  </Text>
                ))}
              </Stack>
            </ScrollableArea>
            <Divider />
            <HStack padding={3} hAlign="end">
              <Text type="supporting" color="secondary">
                {ACTIVITY.length} updates
              </Text>
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
