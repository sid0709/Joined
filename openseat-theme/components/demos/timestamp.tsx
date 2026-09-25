"use client";

import { useState, type ReactNode } from "react";
import { Avatar, Card, Code, HStack, Stack, Text, Timestamp, type TimestampFormat } from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview } from "./shared";

/** A fixed instant so the absolute formats read the same on every visit. */
const FIXED = "2026-03-21T14:51:53Z";
const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FORMATS: TimestampFormat[] = [
  "relative",
  "relative_short",
  "auto",
  "date",
  "date_long",
  "date_weekday",
  "date_time",
  "time",
  "system_date",
  "system_date_time",
  "system_time",
  "unix_seconds",
];
const AGES = [
  { label: "Just now", ago: 5 * SECOND },
  { label: "Minutes", ago: 12 * MINUTE },
  { label: "Hours", ago: 3 * HOUR },
  { label: "Yesterday", ago: DAY + HOUR },
  { label: "Days", ago: 4 * DAY },
  { label: "Weeks", ago: 20 * DAY },
];
const FEED = [
  { who: PEOPLE[0].name, what: "submitted a bid", ago: 4 * MINUTE },
  { who: PEOPLE[1].name, what: "viewed the brief", ago: 2 * HOUR },
  { who: PEOPLE[2].name, what: "asked a question", ago: DAY + 3 * HOUR },
  { who: PEOPLE[3].name, what: "joined the room", ago: 9 * DAY },
];

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function FormatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <HStack gap={3} vAlign="center" wrap="wrap">
      <Stack width={160}>
        <Code>{label}</Code>
      </Stack>
      {children}
    </HStack>
  );
}

export default function TimestampDemo() {
  const [now] = useState(nowSeconds);

  return (
    <Examples>
      <Preview label="Formats" description="Every format for the same instant. The time element always carries the ISO value.">
        <Stack gap={2}>
          {FORMATS.map((format) => (
            <FormatRow key={format} label={format}>
              <Timestamp value={FIXED} format={format} color="primary" />
            </FormatRow>
          ))}
        </Stack>
      </Preview>

      <Preview label="Relative ages" description="relative, relative_short, and auto — auto switches to date_time after a week by default.">
        <Stack gap={2}>
          {AGES.map(({ label, ago }) => (
            <FormatRow key={label} label={label}>
              <HStack gap={4} wrap="wrap">
                <Timestamp value={now - ago} format="relative" />
                <Timestamp value={now - ago} format="relative_short" />
                <Timestamp value={now - ago} format="auto" />
              </HStack>
            </FormatRow>
          ))}
        </Stack>
      </Preview>

      <Preview label="Auto threshold" description="autoThreshold is in seconds. Here: relative for one hour, then absolute.">
        <Stack gap={2}>
          {AGES.slice(1, 4).map(({ label, ago }) => (
            <FormatRow key={label} label={label}>
              <Timestamp value={now - ago} format="auto" autoThreshold={HOUR} />
            </FormatRow>
          ))}
        </Stack>
      </Preview>

      <Preview label="Live" description="isLive keeps relative text current without a re-render from you.">
        <HStack gap={2} vAlign="center">
          <Text>Page opened</Text>
          <Timestamp value={now} format="relative" isLive />
        </HStack>
      </Preview>

      <Preview label="Time zone" description="isTimezoneShown appends the zone to date_time and time.">
        <Stack gap={2}>
          <Timestamp value={FIXED} format="date_time" isTimezoneShown />
          <Timestamp value={FIXED} format="time" isTimezoneShown />
        </Stack>
      </Preview>

      <Preview label="Hover card" description="Hover for the full time. tooltipEntries shows several zones; isCopyable adds a copy button per row.">
        <Stack gap={2}>
          <FormatRow label="default">
            <Timestamp value={now - 3 * HOUR} />
          </FormatRow>
          <FormatRow label="tooltipEntries">
            <Timestamp
              value={now - 3 * HOUR}
              tooltipEntries={[
                { label: "Your time" },
                { timezoneID: "UTC", label: "UTC" },
                { timezoneID: "America/New_York", label: "New York" },
                { timezoneID: "Asia/Tokyo", label: "Tokyo" },
                { timezoneID: "UTC", format: "system_date_time", label: "ISO", isCopyable: true },
              ]}
            />
          </FormatRow>
          <FormatRow label="hasTooltip false">
            <Timestamp value={now - 3 * HOUR} hasTooltip={false} />
          </FormatRow>
        </Stack>
      </Preview>

      <Preview label="Typography" description="Timestamp is Text: type, size, color, and weight all apply.">
        <Stack gap={2}>
          <Timestamp value={FIXED} format="date_long" type="large" color="primary" weight="semibold" />
          <Timestamp value={FIXED} format="date_long" type="body" color="primary" />
          <Timestamp value={FIXED} format="date_long" />
          <Timestamp value={FIXED} format="date_long" color="accent" />
          <Timestamp value={FIXED} format="system_date_time" type="code" />
        </Stack>
      </Preview>

      <Preview label="Activity feed" description="Short relative times beside each event, full time on hover.">
        <Card>
          <Stack gap={3}>
            {FEED.map(({ who, what, ago }) => (
              <HStack key={who} gap={3} vAlign="center" hAlign="between">
                <HStack gap={2} vAlign="center">
                  <Avatar name={who} size="sm" tooltip={false} />
                  <Text>
                    <Text weight="semibold">{who}</Text> {what}
                  </Text>
                </HStack>
                <Timestamp value={now - ago} format="relative_short" />
              </HStack>
            ))}
          </Stack>
        </Card>
        <Caption>Relative values are computed from when you opened this page.</Caption>
      </Preview>
    </Examples>
  );
}
