"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  HStack,
  Icon,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Text,
  Timeline,
  icons,
  type TimelineItem,
  type TimelineVariant,
} from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const HIRING: TimelineItem[] = [
  { id: "posted", title: "Room posted", time: "Mon 9:00", description: "Brand refresh is open for bids.", status: "done" },
  { id: "bids", title: "Six bids in", time: "Tue 14:20", description: "Shortlisted Jordan and Alex.", status: "done" },
  { id: "interview", title: "Interviews", time: "Today", description: "Two calls, 30 minutes each.", status: "current" },
  { id: "award", title: "Award the seat", time: "Thu", description: "Send the offer to one bidder.", status: "upcoming" },
  { id: "kickoff", title: "Kickoff", time: "Mon", status: "upcoming" },
];

const TONES: TimelineItem[] = [
  { id: "posted", title: "Room posted", time: "Mon", description: "Brand refresh is open for bids.", tone: "accent" },
  { id: "bid", title: "Jordan bid", time: "Tue", description: "Fixed price, two weeks.", tone: "neutral" },
  { id: "flag", title: "Budget flagged", time: "Wed", description: "Bid is 20% over the room cap.", tone: "warning" },
  { id: "awarded", title: "Seat awarded", time: "Thu", description: "Jordan is confirmed.", tone: "success" },
];

const ACTIVITY: TimelineItem[] = [
  {
    id: "j",
    group: "Today",
    title: "Jordan joined the room",
    time: "9:02",
    marker: "JM",
    tone: "accent",
    description: "Accepted the brief and the fixed price.",
  },
  {
    id: "a",
    group: "Today",
    title: "Alex left a review",
    time: "9:40",
    marker: "AK",
    tone: "warning",
    meta: "“Type scale feels tight on mobile — try one step up for body.”",
  },
  { id: "s", group: "Yesterday", title: "Preview shipped", time: "16:10", marker: <Icon icon={icons.check} size="sm" />, tone: "success", meta: <Badge label="v0.3" variant="success" /> },
  { id: "p", group: "Yesterday", title: "Payment held in escrow", time: "11:30", marker: "$", tone: "neutral" },
];

const LOG: TimelineItem[] = [
  { id: "1", time: "09:00:12", title: "Room created", description: "by Sam", tone: "neutral" },
  { id: "2", time: "09:02:48", title: "Invite sent", description: "to 4 bidders", tone: "accent" },
  { id: "3", time: "09:15:03", title: "Bid rejected", description: "over budget", tone: "danger" },
  { id: "4", time: "09:31:40", title: "Bid accepted", description: "Jordan · $2,400", tone: "success" },
];

const DELIVERY = ["Bid accepted", "Contract signed", "First draft", "Revisions", "Final files", "Paid"];

const VARIANTS: { value: TimelineVariant; label: string }[] = [
  { value: "rail", label: "Rail" },
  { value: "cards", label: "Cards" },
  { value: "compact", label: "Compact" },
  { value: "alternate", label: "Alternate" },
  { value: "horizontal", label: "Horizontal" },
];

export default function TimelineDemo() {
  const [variant, setVariant] = useState<TimelineVariant>("rail");
  const [stage, setStage] = useState(2);
  const [tone, setTone] = useState<"all" | "success" | "danger">("all");
  const tracking: TimelineItem[] = DELIVERY.map((title, index) => ({
    id: title,
    title,
    status: index < stage ? "done" : index === stage ? "current" : "upcoming",
    time: index < stage ? "Done" : index === stage ? "In progress" : undefined,
  }));
  const logged = LOG.filter((item) => tone === "all" || item.tone === tone);

  return (
    <Examples>
      <Preview label="One dataset, every layout — progress fills the rail">
        <Stack gap={4} hAlign="start">
          <SegmentedControl label="Timeline layout" size="sm" value={variant} onChange={(v) => setVariant(v as TimelineVariant)}>
            {VARIANTS.map((v) => (
              <SegmentedControlItem key={v.value} value={v.value} label={v.label} />
            ))}
          </SegmentedControl>
          <Timeline items={HIRING} variant={variant} label="Hiring progress" />
        </Stack>
      </Preview>
      <Preview label="Activity feed — people, icons, day groups">
        <Timeline items={ACTIVITY} variant="activity" label="Room activity" />
      </Preview>
      <Preview label="Tones — color always sits next to a title">
        <Timeline items={TONES} variant="rail" />
      </Preview>
      <Preview label="Compact log">
        <Timeline items={LOG} variant="compact" label="Audit log" />
      </Preview>
      <Preview label="Milestones">
        <Timeline items={HIRING} variant="horizontal" label="Milestones" />
      </Preview>

      <Preview label="Live tracking — advance the project and watch the rail fill">
        <Card>
          <Stack gap={4}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <Text weight="semibold">Brand refresh · {DELIVERY[Math.min(stage, DELIVERY.length - 1)]}</Text>
              <HStack gap={2}>
                <Button label="Back" size="sm" variant="ghost" isDisabled={stage === 0} onClick={() => setStage((s) => s - 1)} />
                <Button label={stage >= DELIVERY.length ? "Done" : "Next step"} size="sm" variant="primary" isDisabled={stage >= DELIVERY.length} onClick={() => setStage((s) => s + 1)} />
              </HStack>
            </HStack>
            <Timeline items={tracking} variant="horizontal" label="Delivery progress" />
          </Stack>
        </Card>
      </Preview>

      <Preview label="Filtered log — show only what matters">
        <Stack gap={3} hAlign="start">
          <SegmentedControl label="Filter" size="sm" value={tone} onChange={(v) => setTone(v as typeof tone)}>
            <SegmentedControlItem value="all" label="All" />
            <SegmentedControlItem value="success" label="Accepted" />
            <SegmentedControlItem value="danger" label="Rejected" />
          </SegmentedControl>
          <Timeline items={logged} variant="compact" label="Filtered audit log" />
        </Stack>
      </Preview>

      <Preview label="Cards with rich meta">
        <Timeline items={ACTIVITY} variant="cards" label="Room activity as cards" />
      </Preview>
    </Examples>
  );
}
