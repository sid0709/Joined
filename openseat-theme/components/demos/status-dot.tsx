"use client";

import { Avatar, Card, HStack, Heading, Icon, Stack, StatusDot, Text, icons, type StatusDotVariant } from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, Row } from "./shared";

const VARIANTS: { variant: StatusDotVariant; label: string }[] = [
  { variant: "success", label: "Online" },
  { variant: "warning", label: "Degraded" },
  { variant: "error", label: "Down" },
  { variant: "accent", label: "New" },
  { variant: "neutral", label: "Offline" },
];
const SERVICES = [
  { name: "Rooms API", variant: "success" as const, note: "Operational" },
  { name: "Email invites", variant: "warning" as const, note: "Delayed ~5 min" },
  { name: "Escrow payments", variant: "success" as const, note: "Operational" },
  { name: "File uploads", variant: "error" as const, note: "Outage — investigating" },
];
const PRESENCE: StatusDotVariant[] = ["success", "success", "warning", "neutral", "neutral"];
const PRESENCE_LABEL: Record<StatusDotVariant, string> = { success: "Active", warning: "Away", neutral: "Offline", error: "Busy", accent: "New" };

export default function StatusDotDemo() {
  return (
    <Examples>
      <Preview align="start" label="Variants" description="Every dot has a label — read aloud and shown in the tooltip.">
        <Row>
          {VARIANTS.map(({ variant, label }) => (
            <HStack key={variant} gap={2} vAlign="center">
              <StatusDot variant={variant} label={label} />
              <Text>{label}</Text>
            </HStack>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Pulsing" description="isPulsing draws the eye to live or urgent states. Use it sparingly.">
        <Row>
          <HStack gap={2} vAlign="center">
            <StatusDot variant="success" label="Live" isPulsing />
            <Text>Live bidding</Text>
          </HStack>
          <HStack gap={2} vAlign="center">
            <StatusDot variant="error" label="Incident" isPulsing />
            <Text>Incident in progress</Text>
          </HStack>
          <HStack gap={2} vAlign="center">
            <StatusDot variant="accent" label="Unread" isPulsing />
            <Text>New activity</Text>
          </HStack>
        </Row>
      </Preview>

      <Preview align="start" label="Tooltip" description="A tooltip can say more than the label when the dot stands alone.">
        <Row>
          <StatusDot variant="success" label="Synced" tooltip="Synced 2 minutes ago" />
          <StatusDot variant="warning" label="Pending" tooltip="3 changes waiting to sync" />
          <StatusDot variant="error" label="Failed" tooltip="Sync failed — click retry in settings" />
          <Caption>Hover the dots.</Caption>
        </Row>
      </Preview>

      <Preview align="start" label="With an icon" description="An icon inside the dot keeps states apart without color.">
        <Row>
          <StatusDot variant="success" label="Done" icon={<Icon icon={icons.check} />} />
          <StatusDot variant="error" label="Blocked" icon={<Icon icon={icons.close} />} />
          <StatusDot variant="warning" label="Waiting" icon={<Icon icon={icons.clock} />} />
        </Row>
      </Preview>

      <Preview label="Service status" description="A status page — one dot per system, words beside each.">
        <Card maxWidth={440}>
          <Stack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={4}>System status</Heading>
              <HStack gap={2} vAlign="center">
                <StatusDot variant="error" label="Partial outage" isPulsing />
                <Text type="supporting" color="secondary">
                  Partial outage
                </Text>
              </HStack>
            </HStack>
            {SERVICES.map((s) => (
              <HStack key={s.name} hAlign="between" vAlign="center" gap={3}>
                <HStack gap={2} vAlign="center">
                  <StatusDot variant={s.variant} label={s.note} />
                  <Text>{s.name}</Text>
                </HStack>
                <Text type="supporting" color="secondary">
                  {s.note}
                </Text>
              </HStack>
            ))}
          </Stack>
        </Card>
      </Preview>

      <Preview label="Team presence" description="Dots beside names in a member list.">
        <Stack gap={2}>
          {PEOPLE.slice(0, PRESENCE.length).map((person, index) => (
            <HStack key={person.name} gap={3} vAlign="center">
              <Avatar name={person.name} size="sm" tooltip={false} />
              <Stack gap={0}>
                <Text weight="semibold">{person.name}</Text>
                <HStack gap={1} vAlign="center">
                  <StatusDot variant={PRESENCE[index]} label={PRESENCE_LABEL[PRESENCE[index]]} />
                  <Text type="supporting" color="secondary">
                    {PRESENCE_LABEL[PRESENCE[index]]}
                  </Text>
                </HStack>
              </Stack>
            </HStack>
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Legend" description="Explain what the dots on a chart or calendar mean.">
        <Row>
          {[
            { variant: "accent" as const, label: "Your rooms" },
            { variant: "success" as const, label: "Awarded" },
            { variant: "warning" as const, label: "Closing soon" },
            { variant: "neutral" as const, label: "Archived" },
          ].map((item) => (
            <HStack key={item.label} gap={1} vAlign="center">
              <StatusDot variant={item.variant} label={item.label} />
              <Text type="supporting">{item.label}</Text>
            </HStack>
          ))}
        </Row>
      </Preview>
    </Examples>
  );
}
