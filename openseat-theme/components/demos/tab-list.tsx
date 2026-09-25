"use client";

import { useState } from "react";
import {
  Badge,
  Card,
  EmptyState,
  HStack,
  Icon,
  Stack,
  Tab,
  TabList,
  TabMenu,
  Text,
  icons,
  type TabListSize,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const SIZES: TabListSize[] = ["sm", "md", "lg"];
const ROOM_TABS = [
  { value: "brief", label: "Brief", icon: icons.file },
  { value: "bids", label: "Bids", icon: icons.mail, count: 6 },
  { value: "questions", label: "Questions", icon: "info" as const, count: 2 },
  { value: "files", label: "Files", icon: icons.folder },
  { value: "settings", label: "Settings", icon: icons.settings },
];
const PANELS: Record<string, string> = {
  brief: "A full identity refresh for a regional coffee roaster — logo, packaging, and signage.",
  bids: "Six sealed bids. They open when the room closes on Friday.",
  questions: "Two questions waiting for an answer.",
  files: "",
  settings: "Visibility, deadline, and who can bid.",
};
const MANY = ["Overview", "Activity", "Bids", "Questions", "Files", "Invoices", "Contracts", "Reviews", "Settings", "Audit log"];

export default function TabListDemo() {
  const [room, setRoom] = useState("bids");
  const [sizes, setSizes] = useState<Record<TabListSize, string>>({ sm: "a", md: "a", lg: "a" });
  const [fill, setFill] = useState("week");
  const [many, setMany] = useState("Overview");
  const [more, setMore] = useState("details");
  const [icon, setIcon] = useState("grid");

  return (
    <Examples>
      <Preview label="Sizes">
        <Stack gap={4}>
          {SIZES.map((size) => (
            <TabList key={size} size={size} value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))}>
              <Tab value="a" label={`Size ${size}`} />
              <Tab value="b" label="Second" />
              <Tab value="c" label="Third" />
            </TabList>
          ))}
        </Stack>
      </Preview>

      <Preview label="Icons, counts, and panels" description="The classic detail page — icons, counts in end content, and the panel below.">
        <Card>
          <Stack gap={4}>
            <TabList value={room} onChange={setRoom} hasDivider>
              {ROOM_TABS.map((t) => (
                <Tab
                  key={t.value}
                  value={t.value}
                  label={t.label}
                  icon={<Icon icon={t.icon} size="sm" />}
                  endContent={t.count ? <Badge label={t.count} variant={room === t.value ? "info" : "neutral"} /> : undefined}
                />
              ))}
            </TabList>
            {PANELS[room] ? <Text>{PANELS[room]}</Text> : <EmptyState isCompact title="No files yet" description="Drop files in the Files tab to share them." />}
          </Stack>
        </Card>
      </Preview>

      <Preview label="Fill the width" description="layout=&quot;fill&quot; stretches tabs evenly — good for two to four peers on mobile.">
        <Stack maxWidth={420}>
          <TabList value={fill} onChange={setFill} layout="fill" hasDivider>
            <Tab value="day" label="Day" />
            <Tab value="week" label="Week" />
            <Tab value="month" label="Month" />
          </TabList>
        </Stack>
      </Preview>

      <Preview label="Icon-only" description="isLabelHidden keeps the label as the accessible name and tooltip.">
        <TabList value={icon} onChange={setIcon}>
          <Tab value="grid" label="Grid view" isLabelHidden icon={<Icon icon={icons.grid} />} />
          <Tab value="list" label="List view" isLabelHidden icon={<Icon icon={icons.list} />} />
          <Tab value="calendar" label="Calendar view" isLabelHidden icon={<Icon icon="calendar" />} />
        </TabList>
      </Preview>

      <Preview label="Overflow" description="Many tabs scroll, or collapse the rest into a More menu automatically.">
        <Stack gap={4}>
          <Card maxWidth={420}>
            <TabList value={many} onChange={setMany} overflow="auto">
              {MANY.map((t) => (
                <Tab key={t} value={t} label={t} />
              ))}
            </TabList>
          </Card>
          <Card maxWidth={420}>
            <TabList value={many} onChange={setMany} overflow="scroll">
              {MANY.map((t) => (
                <Tab key={t} value={t} label={t} />
              ))}
            </TabList>
          </Card>
          <Caption>Selected: {many}</Caption>
        </Stack>
      </Preview>

      <Preview label="Tab menu" description="TabMenu groups rarely used views under one tab.">
        <TabList value={more} onChange={setMore} hasDivider>
          <Tab value="details" label="Details" />
          <Tab value="bids" label="Bids" />
          <TabMenu
            label="More"
            options={[
              { value: "invoices", label: "Invoices" },
              { value: "contracts", label: "Contracts" },
              { value: "audit", label: "Audit log" },
            ]}
          />
        </TabList>
      </Preview>

      <Preview label="Full bleed" description="isFullBleed runs the divider to the card edges.">
        <Card>
          <Stack gap={3}>
            <TabList value={fill} onChange={setFill} hasDivider isFullBleed>
              <Tab value="day" label="Day" />
              <Tab value="week" label="Week" />
              <Tab value="month" label="Month" />
            </TabList>
            <HStack gap={2}>
              <Text color="secondary">Showing the {fill} view.</Text>
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
