"use client";

import { useState } from "react";
import {
  Calendar,
  Icon,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Text,
  Timeline,
  icons,
  type SegmentedControlSize,
  type TimelineItem,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const SIZES: SegmentedControlSize[] = ["sm", "md", "lg"];

const BILLING = { monthly: "$12 / month", yearly: "$120 / year — two months free" } as const;

const ACTIVITY: TimelineItem[] = [
  { id: "1", title: "Room posted", time: "Mon", status: "done" },
  { id: "2", title: "Bids in", time: "Tue", status: "done" },
  { id: "3", title: "Interviews", time: "Today", status: "current" },
  { id: "4", title: "Award", time: "Thu", status: "upcoming" },
];

export default function SegmentedControlDemo() {
  const [view, setView] = useState("list");
  const [range, setRange] = useState("week");
  const [align, setAlign] = useState("left");
  const [billing, setBilling] = useState<keyof typeof BILLING>("monthly");
  const [layout, setLayout] = useState("rail");
  const [calendarView, setCalendarView] = useState("month");
  const [sizes, setSizes] = useState<Record<SegmentedControlSize, string>>({ sm: "a", md: "a", lg: "a" });

  return (
    <Examples>
      <Preview align="start" label="Text" description="A closed set of mutually exclusive views — keep it to a handful.">
        <Stack gap={2} hAlign="start">
          <SegmentedControl label="Date range" value={range} onChange={setRange}>
            <SegmentedControlItem value="day" label="Day" />
            <SegmentedControlItem value="week" label="Week" />
            <SegmentedControlItem value="month" label="Month" />
            <SegmentedControlItem value="year" label="Year" />
          </SegmentedControl>
          <Caption>Showing the last {range}.</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Icon and text">
        <SegmentedControl label="View" value={view} onChange={setView}>
          <SegmentedControlItem value="list" label="List" icon={<Icon icon={icons.list} />} />
          <SegmentedControlItem value="grid" label="Grid" icon={<Icon icon={icons.grid} />} />
          <SegmentedControlItem value="calendar" label="Calendar" icon={<Icon icon={icons.calendar} />} />
        </SegmentedControl>
      </Preview>

      <Preview align="start" label="Icon only" description="Hidden labels still name each segment for screen readers.">
        <SegmentedControl label="Text alignment" value={align} onChange={setAlign}>
          <SegmentedControlItem value="left" label="Align left" isLabelHidden icon={<Icon icon={icons.alignLeft} />} />
          <SegmentedControlItem value="center" label="Align center" isLabelHidden icon={<Icon icon={icons.alignCenter} />} />
          <SegmentedControlItem value="right" label="Align right" isLabelHidden icon={<Icon icon={icons.alignRight} />} />
        </SegmentedControl>
      </Preview>

      <Preview align="start" label="Sizes">
        <Stack gap={3} hAlign="start">
          {SIZES.map((size) => (
            <SegmentedControl key={size} label={`${size} control`} size={size} value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))}>
              <SegmentedControlItem value="a" label={`${size.toUpperCase()} one`} />
              <SegmentedControlItem value="b" label="Two" />
              <SegmentedControlItem value="c" label="Three" />
            </SegmentedControl>
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Fill layout" description="Segments stretch evenly across the container.">
        <Stack gap={2} width={360}>
          <SegmentedControl label="Billing period" layout="fill" value={billing} onChange={(v) => setBilling(v as keyof typeof BILLING)}>
            <SegmentedControlItem value="monthly" label="Monthly" />
            <SegmentedControlItem value="yearly" label="Yearly" />
          </SegmentedControl>
          <Text weight="medium">{BILLING[billing]}</Text>
        </Stack>
      </Preview>

      <Preview align="start" label="Disabled">
        <Stack gap={3} hAlign="start">
          <SegmentedControl label="Locked view" value="one" onChange={() => {}} isDisabled disabledMessage="Upgrade to switch views">
            <SegmentedControlItem value="one" label="Board" />
            <SegmentedControlItem value="two" label="Timeline" />
          </SegmentedControl>
          <SegmentedControl label="Partly available" value="free" onChange={() => {}}>
            <SegmentedControlItem value="free" label="Free" />
            <SegmentedControlItem value="pro" label="Pro" isDisabled />
          </SegmentedControl>
        </Stack>
      </Preview>

      <Preview label="Pattern — switch a component's layout">
        <Stack gap={4} hAlign="start">
          <SegmentedControl label="Timeline layout" size="sm" value={layout} onChange={setLayout}>
            <SegmentedControlItem value="rail" label="Rail" />
            <SegmentedControlItem value="cards" label="Cards" />
            <SegmentedControlItem value="horizontal" label="Across" />
          </SegmentedControl>
          <Timeline items={ACTIVITY} variant={layout as "rail" | "cards" | "horizontal"} />
        </Stack>
      </Preview>

      <Preview label="Pattern — calendar views">
        <Stack gap={3} hAlign="start">
          <SegmentedControl label="Calendar view" size="sm" value={calendarView} onChange={setCalendarView}>
            <SegmentedControlItem value="month" label="Month" />
            <SegmentedControlItem value="agenda" label="Agenda" />
          </SegmentedControl>
          <Calendar view={calendarView as "month" | "agenda"} size="sm" />
        </Stack>
      </Preview>
    </Examples>
  );
}
