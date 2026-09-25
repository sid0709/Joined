"use client";

import {
  Avatar,
  Badge,
  Button,
  Card,
  HStack,
  HoverCard,
  Icon,
  Link,
  ProgressBar,
  Rating,
  Stack,
  Text,
  icons,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, Row } from "./shared";

const PLACEMENTS = ["above", "below", "start", "end"] as const;

function PersonCard({ name, role }: { name: string; role: string }) {
  return (
    <Stack gap={2}>
      <HStack gap={2} vAlign="center">
        <Avatar name={name} size="lg" tooltip={false} />
        <Stack gap={0}>
          <Text weight="semibold">{name}</Text>
          <Text type="supporting" color="secondary">
            {role} · Portland
          </Text>
        </Stack>
      </HStack>
      <Rating value={5} readOnly size="sm" label={`${name} rating`} />
      <HStack gap={2}>
        <Badge label="Top rated" variant="success" />
        <Badge label="Replies fast" variant="info" />
      </HStack>
      <Button label="Invite to bid" size="sm" variant="primary" />
    </Stack>
  );
}

export default function HoverCardDemo() {
  return (
    <Examples>
      <Preview align="start" label="People" description="Hover a name for a rich preview; interactive content inside stays reachable.">
        <Text>
          Bids from{" "}
          {PEOPLE.slice(0, 3).map((p, i) => (
            <span key={p.name}>
              <HoverCard content={<PersonCard {...p} />} label={p.name}>
                <Link href={`#${p.name}`}>{p.name}</Link>
              </HoverCard>
              {i < 2 ? ", " : ""}
            </span>
          ))}
          .
        </Text>
      </Preview>

      <Preview align="start" label="Room preview" description="A card in the card — progress, deadline, and budget.">
        <HoverCard
          content={
            <Stack gap={2}>
              <Text weight="semibold">Brand refresh</Text>
              <Text type="supporting" color="secondary">
                Fixed · $2,400 · closes Friday
              </Text>
              <ProgressBar label="Invitees who bid" value={4} max={6} hasValueLabel formatValueLabel={(v, m) => `${v} of ${m}`} />
            </Stack>
          }
        >
          <Button label="Brand refresh" variant="ghost" icon={<Icon icon={icons.seat} />} />
        </HoverCard>
      </Preview>

      <Preview align="start" label="Placement">
        <Row>
          {PLACEMENTS.map((placement) => (
            <HoverCard key={placement} placement={placement} content={<Text>Opens {placement}.</Text>}>
              <Button label={placement} />
            </HoverCard>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Delays" description="Longer delays avoid flicker as the pointer passes over dense lists.">
        <Row>
          <HoverCard delay={0} content={<Text>Instant</Text>}>
            <Button label="No delay" />
          </HoverCard>
          <HoverCard delay={800} hideDelay={400} content={<Text>Waited 800 ms</Text>}>
            <Button label="800 ms" />
          </HoverCard>
        </Row>
      </Preview>

      <Preview align="start" label="Avatar stack" description="Each face previews its person.">
        <Card maxWidth={360}>
          <HStack gap={2} vAlign="center">
            {PEOPLE.slice(0, 5).map((p) => (
              <HoverCard key={p.name} content={<PersonCard {...p} />}>
                <Avatar name={p.name} tooltip={false} onClick={() => undefined} />
              </HoverCard>
            ))}
          </HStack>
        </Card>
        <Caption>Hover or focus an avatar.</Caption>
      </Preview>
    </Examples>
  );
}
