"use client";

import { useState } from "react";
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
  ClickableCard,
  Divider,
  HStack,
  Heading,
  Icon,
  JobCard,
  ProgressBar,
  SelectableCard,
  Stack,
  Text,
  icons,
  type CardVariant,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, Row, SAMPLE_IMAGES } from "./shared";

const VARIANTS: CardVariant[] = ["default", "muted", "transparent", "blue", "cyan", "teal", "green", "yellow", "orange", "red", "pink", "purple", "gray"];
const ELEVATIONS = ["none", "low", "med", "high"] as const;
const PADDINGS = [2, 3, 4, 6] as const;
const TILE = 168;
const ROOM_WIDTH = 240;

const ROOMS = [
  { id: "brand", title: "Brand refresh", meta: "Fixed · $2,400", bids: 6, closes: "Closes Friday", status: "Open" as const },
  { id: "landing", title: "Landing page copy", meta: "Hourly · $65/hr", bids: 2, closes: "Closes in 2 days", status: "Review" as const },
  { id: "motion", title: "Motion system", meta: "Fixed · $3,200", bids: 0, closes: "Draft", status: "Draft" as const },
];
const STATUS_VARIANT = { Open: "success", Review: "warning", Draft: "neutral" } as const;

const PLANS = [
  { id: "starter", name: "Starter", price: "$0", blurb: "Three sealed rooms a month." },
  { id: "team", name: "Team", price: "$24", blurb: "Unlimited rooms and shared shortlists." },
  { id: "agency", name: "Agency", price: "$79", blurb: "Client workspaces and white-label invites." },
];
const ADD_ONS = [
  { id: "nda", name: "NDA on invite", price: "+$5" },
  { id: "escrow", name: "Escrow payments", price: "+$12" },
  { id: "priority", name: "Priority support", price: "+$9" },
];
const STATS = [
  { label: "Open rooms", value: "24", delta: "+3 this week", icon: icons.seat },
  { label: "Bids received", value: "138", delta: "+18%", icon: icons.mail },
  { label: "Avg. time to award", value: "4.2 d", delta: "−0.8 d", icon: icons.clock },
];

export default function CardDemo() {
  const [plan, setPlan] = useState("team");
  const [addOns, setAddOns] = useState<string[]>(["nda"]);
  const [opened, setOpened] = useState<string | null>(null);
  const [chosen, setChosen] = useState("brand");

  return (
    <Examples>
      <Preview align="start" label="Variants" description="default and muted for surfaces; transparent to group without a fill; colors for categories and highlights.">
        <HStack gap={3} wrap="wrap">
          {VARIANTS.map((variant) => (
            <Card key={variant} variant={variant} width={TILE}>
              <Stack gap={1}>
                <Text weight="semibold">{variant}</Text>
                <Text type="supporting" color="secondary">
                  variant=&quot;{variant}&quot;
                </Text>
              </Stack>
            </Card>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Elevation" description="Flat by default. Lift only cards that float above other content.">
        <HStack gap={4} wrap="wrap">
          {ELEVATIONS.map((elevation) => (
            <Card key={elevation} elevation={elevation} width={TILE}>
              <Text weight="semibold">{elevation}</Text>
            </Card>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Padding" description="Steps from the spacing scale — tighter for dense lists, roomier for heroes.">
        <HStack gap={3} wrap="wrap" vAlign="start">
          {PADDINGS.map((padding) => (
            <Card key={padding} padding={padding} variant="muted">
              <Text>padding={padding}</Text>
            </Card>
          ))}
        </HStack>
      </Preview>

      <Preview label="Stat cards" description="A dashboard row — icon, value, and trend in muted cards.">
        <HStack gap={3} wrap="wrap" vAlign="stretch">
          {STATS.map((stat) => (
            <Card key={stat.label} variant="muted" width={200}>
              <Stack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Icon icon={stat.icon} color="secondary" size="sm" />
                  <Text type="supporting" color="secondary">
                    {stat.label}
                  </Text>
                </HStack>
                <Text type="display-3">{stat.value}</Text>
                <Text type="supporting" color="accent">
                  {stat.delta}
                </Text>
              </Stack>
            </Card>
          ))}
        </HStack>
      </Preview>

      <Preview label="Clickable cards" description="The whole card is one link or button, with a single accessible name.">
        <Stack gap={2}>
          <HStack gap={3} wrap="wrap" vAlign="stretch">
            {ROOMS.map((room) => (
              <ClickableCard key={room.id} label={`Open ${room.title}`} onClick={() => setOpened(room.title)} width={ROOM_WIDTH} isDisabled={room.status === "Draft"}>
                <Stack gap={2}>
                  <HStack hAlign="between" vAlign="center">
                    <Badge label={room.status} variant={STATUS_VARIANT[room.status]} />
                    <Text type="supporting" color="secondary">
                      {room.closes}
                    </Text>
                  </HStack>
                  <Heading level={4}>{room.title}</Heading>
                  <Text type="supporting" color="secondary">
                    {room.meta} · {room.bids} bids
                  </Text>
                </Stack>
              </ClickableCard>
            ))}
          </HStack>
          <Caption>{opened ? `Opened “${opened}”` : "Click a room. Drafts are disabled."}</Caption>
        </Stack>
      </Preview>

      <Preview label="Selectable cards — one plan" description="Cards as big radio options: only one stays selected.">
        <HStack gap={3} wrap="wrap" vAlign="stretch">
          {PLANS.map((p) => (
            <SelectableCard key={p.id} label={p.name} isSelected={plan === p.id} onChange={() => setPlan(p.id)} width={ROOM_WIDTH}>
              <Stack gap={1}>
                <HStack hAlign="between" vAlign="center">
                  <Text weight="semibold">{p.name}</Text>
                  {p.id === "team" && <Badge label="Popular" variant="blue" />}
                </HStack>
                <Text type="display-3">
                  {p.price}
                  <Text type="supporting" color="secondary">
                    {" "}
                    / month
                  </Text>
                </Text>
                <Text type="supporting" color="secondary">
                  {p.blurb}
                </Text>
              </Stack>
            </SelectableCard>
          ))}
        </HStack>
      </Preview>

      <Preview label="Selectable cards — any add-ons" description="Each card toggles on its own, like a checkbox.">
        <Stack gap={2}>
          <HStack gap={3} wrap="wrap">
            {ADD_ONS.map((a) => (
              <SelectableCard
                key={a.id}
                label={a.name}
                padding={3}
                isSelected={addOns.includes(a.id)}
                onChange={(on) => setAddOns((all) => (on ? [...all, a.id] : all.filter((x) => x !== a.id)))}
                isDisabled={a.id === "priority" && plan === "starter"}
              >
                <HStack gap={3} vAlign="center">
                  <Text weight="semibold">{a.name}</Text>
                  <Text color="secondary">{a.price}</Text>
                </HStack>
              </SelectableCard>
            ))}
          </HStack>
          <Caption>
            {PLANS.find((p) => p.id === plan)?.name} plan · {addOns.length} add-on{addOns.length === 1 ? "" : "s"}
          </Caption>
        </Stack>
      </Preview>

      <Preview label="Room cards" description="JobCard composes Card for OpenSeat rooms — static, clickable, selected, or raised.">
        <HStack gap={3} wrap="wrap" vAlign="stretch">
          {ROOMS.map((room) => (
            <JobCard
              key={room.id}
              title={room.title}
              meta={room.meta}
              footer={room.closes}
              width={ROOM_WIDTH}
              selected={chosen === room.id}
              onClick={() => setChosen(room.id)}
            >
              <HStack gap={2} vAlign="center">
                <Badge label={room.status} variant={STATUS_VARIANT[room.status]} />
                <Text type="supporting" color="secondary">
                  {room.bids} bids
                </Text>
              </HStack>
            </JobCard>
          ))}
          <JobCard title="Raised card" meta="Floats over a map or canvas" raised width={ROOM_WIDTH} />
        </HStack>
      </Preview>

      <Preview label="Profile card" description="Media, identity, stats, and actions in one card.">
        <Card width={320}>
          <Stack gap={3}>
            <Avatar name="Dana Kim" size="lg" src={SAMPLE_IMAGES.missing} />
            <Stack gap={0.5}>
              <Heading level={4}>Dana Kim</Heading>
              <Text type="supporting" color="secondary">
                Copywriter · Portland
              </Text>
            </Stack>
            <HStack gap={4}>
              <Stack gap={0}>
                <Text weight="semibold">42</Text>
                <Caption>Rooms won</Caption>
              </Stack>
              <Stack gap={0}>
                <Text weight="semibold">4.9</Text>
                <Caption>Rating</Caption>
              </Stack>
              <Stack gap={0}>
                <Text weight="semibold">2 d</Text>
                <Caption>Reply time</Caption>
              </Stack>
            </HStack>
            <Divider />
            <HStack gap={2}>
              <Button label="Invite to bid" variant="primary" size="sm" />
              <Button label="Message" size="sm" icon={<Icon icon={icons.mail} />} />
            </HStack>
          </Stack>
        </Card>
      </Preview>

      <Preview label="Room summary" description="Nested content — progress, people, and a footer action.">
        <Card maxWidth={420}>
          <Stack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={4}>Brand refresh</Heading>
              <Badge label="Open" variant="success" icon={<Icon icon={icons.lock} size="xsm" />} />
            </HStack>
            <ProgressBar label="Invitees who bid" value={4} max={6} hasValueLabel formatValueLabel={(v, m) => `${v} of ${m}`} />
            <HStack hAlign="between" vAlign="center">
              <AvatarGroup size="sm">
                {PEOPLE.slice(0, 4).map((person) => (
                  <Avatar key={person.name} name={person.name} />
                ))}
              </AvatarGroup>
              <Text type="supporting" color="secondary">
                Closes Friday, 5 PM
              </Text>
            </HStack>
            <Divider isFullBleed />
            <Row>
              <Button label="Compare bids" variant="primary" size="sm" />
              <Button label="Extend deadline" variant="ghost" size="sm" />
            </Row>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
