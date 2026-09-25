"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  HStack,
  Heading,
  Icon,
  IconButton,
  Stack,
  Text,
  icons,
  type BadgeVariant,
} from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const STATUS: { variant: BadgeVariant; label: string }[] = [
  { variant: "neutral", label: "Draft" },
  { variant: "info", label: "Invited" },
  { variant: "success", label: "Awarded" },
  { variant: "warning", label: "Closing soon" },
  { variant: "error", label: "Revoked" },
];
const COLORS: BadgeVariant[] = ["blue", "cyan", "teal", "green", "yellow", "orange", "red", "pink", "purple"];
const LIFECYCLE = [
  { step: "Draft", variant: "neutral" as const, icon: icons.edit },
  { step: "Open", variant: "info" as const, icon: icons.lock },
  { step: "Reviewing", variant: "warning" as const, icon: icons.eye },
  { step: "Awarded", variant: "success" as const, icon: icons.check },
];
const SKILLS = [
  { label: "Branding", variant: "blue" as const },
  { label: "Packaging", variant: "orange" as const },
  { label: "Motion", variant: "teal" as const },
  { label: "Copywriting", variant: "purple" as const },
  { label: "Illustration", variant: "pink" as const },
];
const BIDDERS = [
  { name: "Jordan Miles", price: "$2,400", badges: [{ label: "Lowest", variant: "success" as const }] },
  { name: "Alex Rivera", price: "$2,900", badges: [{ label: "Fastest", variant: "info" as const }, { label: "Returning", variant: "purple" as const }] },
  { name: "Dana Kim", price: "$3,150", badges: [{ label: "Late", variant: "warning" as const }] },
];

export default function BadgeDemo() {
  const [unread, setUnread] = useState(4);

  return (
    <Examples>
      <Preview align="start" label="Status" description="Semantic variants — each one always pairs color with a word.">
        <Row>
          {STATUS.map(({ variant, label }) => (
            <Badge key={variant} label={label} variant={variant} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Categories" description="Palette variants tag kinds of things, never states.">
        <Row>
          {COLORS.map((variant) => (
            <Badge key={variant} label={variant} variant={variant} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="With an icon" description="An icon reinforces the word — useful when badges are scanned in a column.">
        <Row>
          <Badge label="Verified" variant="success" icon={<Icon icon={icons.check} size="xsm" />} />
          <Badge label="Sealed" variant="info" icon={<Icon icon={icons.lock} size="xsm" />} />
          <Badge label="Due today" variant="warning" icon={<Icon icon={icons.clock} size="xsm" />} />
          <Badge label="Blocked" variant="error" icon={<Icon icon="error" size="xsm" />} />
          <Badge label="Featured" variant="yellow" icon={<Icon icon={icons.star} size="xsm" />} />
          <Badge label="New" variant="purple" icon={<Icon icon={icons.sparkle} size="xsm" />} />
        </Row>
      </Preview>

      <Preview align="start" label="Counts" description="Numbers as badges on buttons and nav items. label accepts any node.">
        <Stack gap={3} hAlign="start">
          <Row>
            <Button label="Inbox" icon={<Icon icon={icons.mail} />} endContent={<Badge label={unread} variant="info" />} onClick={() => setUnread((n) => Math.max(0, n - 1))} />
            <Button label="Bids" variant="ghost" endContent={<Badge label="12" />} />
            <Button label="Alerts" variant="secondary" endContent={<Badge label="99+" variant="error" />} />
          </Row>
          <Caption>Click Inbox to read one message.</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Room lifecycle" description="A legend of every state a room moves through.">
        <HStack gap={2} vAlign="center" wrap="wrap">
          {LIFECYCLE.map((item, index) => (
            <HStack key={item.step} gap={2} vAlign="center">
              {index > 0 && <Icon icon={icons.arrowRight} size="sm" color="tertiary" />}
              <Badge label={item.step} variant={item.variant} icon={<Icon icon={item.icon} size="xsm" />} />
            </HStack>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Skill tags" description="Categories on a profile.">
        <Row>
          {SKILLS.map((skill) => (
            <Badge key={skill.label} {...skill} />
          ))}
        </Row>
      </Preview>

      <Preview label="In a list" description="Badges summarize each row so people can compare at a glance.">
        <Card>
          <Stack gap={3}>
            <Heading level={4}>Bids · Brand refresh</Heading>
            {BIDDERS.map((bidder) => (
              <HStack key={bidder.name} hAlign="between" vAlign="center" gap={3} wrap="wrap">
                <HStack gap={2} vAlign="center">
                  <Avatar name={bidder.name} size="sm" tooltip={false} />
                  <Text weight="semibold">{bidder.name}</Text>
                  {bidder.badges.map((b) => (
                    <Badge key={b.label} {...b} />
                  ))}
                </HStack>
                <Text hasTabularNumbers>{bidder.price}</Text>
              </HStack>
            ))}
          </Stack>
        </Card>
      </Preview>

      <Preview align="start" label="In a heading" description="Status beside a title — the top of a detail page.">
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Heading level={2}>Brand refresh</Heading>
          <Badge label="Open" variant="success" />
          <Badge label="Sealed" variant="info" icon={<Icon icon={icons.lock} size="xsm" />} />
          <IconButton label="Share" variant="ghost" size="sm" icon={<Icon icon={icons.share} />} />
        </HStack>
      </Preview>
    </Examples>
  );
}
