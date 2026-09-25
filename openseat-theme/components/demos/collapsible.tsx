"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Collapsible,
  CollapsibleGroup,
  HStack,
  Icon,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Switch,
  Text,
  icons,
  type CollapsibleGroupDensity,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const FAQ = [
  { id: "sealed", q: "What does “sealed” mean?", a: "Nobody — including you — sees a bid until the room closes. Then every bid is revealed at once." },
  { id: "invite", q: "Who can see my room?", a: "Only the people you invite. Rooms never show up in search." },
  { id: "change", q: "Can a bidder change their bid?", a: "Yes, until the deadline. After that, bids are locked." },
  { id: "fees", q: "Are there fees?", a: "Starter is free. Paid plans add unlimited rooms and escrow." },
];
const DENSITIES: CollapsibleGroupDensity[] = ["compact", "balanced", "spacious"];
const NOTIFY = [
  { id: "bids", label: "New bids", description: "Each time an invitee submits." },
  { id: "questions", label: "Questions", description: "When someone asks about the brief." },
  { id: "closing", label: "Closing soon", description: "24 hours before the deadline." },
];

export default function CollapsibleDemo() {
  const [open, setOpen] = useState(false);
  const [single, setSingle] = useState<string | string[]>("sealed");
  const [density, setDensity] = useState<CollapsibleGroupDensity>("balanced");
  const [notify, setNotify] = useState<Record<string, boolean>>({ bids: true, questions: true, closing: false });
  const on = Object.values(notify).filter(Boolean).length;

  return (
    <Examples>
      <Preview label="Basic" description="A trigger that shows and hides one region.">
        <Collapsible trigger="Room rules">
          <Text color="secondary">Bids are sealed until the deadline. Invitees can ask questions; answers are shared with everyone.</Text>
        </Collapsible>
      </Preview>

      <Preview label="Open by default" description="defaultIsOpen for the region people usually need.">
        <Collapsible trigger="Brief" defaultIsOpen>
          <Text color="secondary">A full identity refresh for a regional coffee roaster — logo, packaging, and signage.</Text>
        </Collapsible>
      </Preview>

      <Preview label="Chevron position" description="end for settings rows; start for outlines and nested lists.">
        <Stack gap={2}>
          <Collapsible trigger="Chevron at the end (default)">
            <Text color="secondary">Reads like a settings row.</Text>
          </Collapsible>
          <Collapsible trigger="Chevron at the start" chevronPosition="start">
            <Text color="secondary">Reads like an outline.</Text>
          </Collapsible>
        </Stack>
      </Preview>

      <Preview label="Controlled" description="isOpen and onOpenChange let other controls open it.">
        <Stack gap={2}>
          <HStack gap={2}>
            <Button label={open ? "Hide details" : "Show details"} size="sm" onClick={() => setOpen((v) => !v)} />
            <Button label="Reset" size="sm" variant="ghost" onClick={() => setOpen(false)} />
          </HStack>
          <Collapsible trigger="Payment details" isOpen={open} onOpenChange={setOpen}>
            <Text color="secondary">Paid through escrow. Funds release when you mark the work complete.</Text>
          </Collapsible>
        </Stack>
      </Preview>

      <Preview label="Disabled" description="Keeps the heading visible while the region is unavailable.">
        <Collapsible trigger="Bids (available after the deadline)" isDisabled>
          <Text>Hidden</Text>
        </Collapsible>
      </Preview>

      <Preview label="Rich trigger" description="The trigger can hold icons, badges, and counts.">
        <Collapsible
          trigger={
            <HStack gap={2} vAlign="center">
              <Icon icon={icons.bell} size="sm" />
              <Text weight="semibold">Notifications</Text>
              <Badge label={`${on} on`} variant={on ? "info" : "neutral"} />
            </HStack>
          }
          defaultIsOpen
        >
          <Stack gap={3}>
            {NOTIFY.map((n) => (
              <Switch
                key={n.id}
                label={n.label}
                description={n.description}
                value={notify[n.id]}
                onChange={(value) => setNotify((c) => ({ ...c, [n.id]: value }))}
                labelSpacing="spread"
              />
            ))}
          </Stack>
        </Collapsible>
      </Preview>

      <Preview label="Accordion — one at a time" description="CollapsibleGroup type=&quot;single&quot; closes the others when one opens.">
        <Stack gap={2}>
          <CollapsibleGroup type="single" value={single} onChange={setSingle} hasDividers>
            {FAQ.map((item) => (
              <Collapsible key={item.id} value={item.id} trigger={item.q}>
                <Text color="secondary">{item.a}</Text>
              </Collapsible>
            ))}
          </CollapsibleGroup>
          <Caption>Open: {Array.isArray(single) ? single.join(", ") || "none" : single || "none"}</Caption>
        </Stack>
      </Preview>

      <Preview label="Accordion — many at once" description="type=&quot;multiple&quot; with dividers and a default set.">
        <CollapsibleGroup type="multiple" defaultValue={["invite", "fees"]} hasDividers>
          {FAQ.map((item) => (
            <Collapsible key={item.id} value={item.id} trigger={item.q}>
              <Text color="secondary">{item.a}</Text>
            </Collapsible>
          ))}
        </CollapsibleGroup>
      </Preview>

      <Preview label="Density" description="compact for side panels, spacious for help pages.">
        <Stack gap={3}>
          <SegmentedControl label="Density" size="sm" value={density} onChange={(v) => setDensity(v as CollapsibleGroupDensity)}>
            {DENSITIES.map((d) => (
              <SegmentedControlItem key={d} value={d} label={d} />
            ))}
          </SegmentedControl>
          <Card>
            <CollapsibleGroup type="multiple" density={density} hasDividers chevronPosition="start">
              {FAQ.map((item) => (
                <Collapsible key={item.id} value={item.id} trigger={item.q}>
                  <Text color="secondary">{item.a}</Text>
                </Collapsible>
              ))}
            </CollapsibleGroup>
          </Card>
        </Stack>
      </Preview>
    </Examples>
  );
}
