"use client";

import {
  AspectRatio,
  Button,
  Card,
  HStack,
  Icon,
  ResponsiveFrame,
  ResponsiveStack,
  Stack,
  StackItem,
  Text,
  Tile,
  VStack,
  icons,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const GAPS = [0.5, 1, 2, 3, 4, 6, 8] as const;
const ALIGNS = ["start", "center", "end", "between"] as const;

export default function StackDemo() {
  return (
    <Examples>
      <Preview label="Vertical and horizontal" description="VStack and HStack are Stack with the direction preset.">
        <HStack gap={6} vAlign="start">
          <VStack gap={2} width={160}>
            <Tile>One</Tile>
            <Tile>Two</Tile>
            <Tile>Three</Tile>
          </VStack>
          <HStack gap={2}>
            <Tile>One</Tile>
            <Tile>Two</Tile>
            <Tile>Three</Tile>
          </HStack>
        </HStack>
      </Preview>

      <Preview label="Gap scale" description="Spacing steps map to the 4px token grid.">
        <Stack gap={3}>
          {GAPS.map((gap) => (
            <HStack key={gap} gap={3} vAlign="center">
              <Text type="supporting" color="secondary" hasTabularNumbers>
                gap {gap}
              </Text>
              <HStack gap={gap}>
                {[1, 2, 3, 4].map((n) => (
                  <Tile key={n} tone="neutral">
                    {n}
                  </Tile>
                ))}
              </HStack>
            </HStack>
          ))}
        </Stack>
      </Preview>

      <Preview label="Main-axis alignment" description="hAlign on an HStack distributes children along the row.">
        <Stack gap={2}>
          {ALIGNS.map((align) => (
            <Card key={align} padding={2}>
              <HStack gap={2} hAlign={align}>
                <Tile>{align}</Tile>
                <Tile tone="neutral">B</Tile>
                <Tile tone="neutral">C</Tile>
              </HStack>
            </Card>
          ))}
        </Stack>
      </Preview>

      <Preview label="Cross-axis alignment" description="vAlign on an HStack lines children up by top, center, bottom, or stretch.">
        <HStack gap={4} wrap="wrap">
          {(["start", "center", "end", "stretch"] as const).map((align) => (
            <Card key={align} padding={2} width={180}>
              <HStack gap={2} vAlign={align} height={100}>
                <Tile height={40}>{align}</Tile>
                <Tile tone="neutral" height={70}>
                  B
                </Tile>
              </HStack>
            </Card>
          ))}
        </HStack>
      </Preview>

      <Preview label="Grow and fixed items" description="StackItem size fill takes the leftover space; content hugs.">
        <Card padding={3}>
          <HStack gap={3} vAlign="center">
            <Icon icon={icons.search} />
            <StackItem size="fill">
              <Text color="secondary">Search rooms, people, and bids…</Text>
            </StackItem>
            <Button label="Search" variant="primary" size="sm" />
          </HStack>
        </Card>
      </Preview>

      <Preview label="Wrapping" description="wrap lets chips flow onto new lines instead of overflowing.">
        <HStack gap={2} wrap="wrap">
          {["Branding", "Web", "Motion", "Illustration", "Copywriting", "3D", "Research", "Strategy", "Video", "Photography"].map((tag) => (
            <Tile key={tag} tone="neutral">
              {tag}
            </Tile>
          ))}
        </HStack>
      </Preview>

      <Preview
        label="Responsive — stack on phones, row from md"
        description="ResponsiveStack is a column until its tier, then a row. Drag the frame edge."
      >
        <ResponsiveFrame defaultPreset="Tablet">
          <ResponsiveStack from="md" gap={4} isEqual>
            <Tile height={100} meta="1 / 3">
              Plan
            </Tile>
            <Tile height={100} meta="2 / 3">
              Bid
            </Tile>
            <Tile height={100} meta="3 / 3">
              Award
            </Tile>
          </ResponsiveStack>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Responsive media object" description="Image beside copy on wide frames; image on top when narrow, via isReversedWhenStacked.">
        <ResponsiveFrame defaultPreset="Phone">
          <ResponsiveStack from="sm" gap={4} align="center" isReversedWhenStacked>
            <Stack gap={2}>
              <Text type="large" weight="semibold">
                Brand refresh
              </Text>
              <Text color="secondary">Six bids in two days. Interviews start Thursday.</Text>
              <HStack gap={2}>
                <Button label="Review bids" variant="primary" size="sm" />
                <Button label="Share" size="sm" />
              </HStack>
            </Stack>
            <Stack width={200}>
              <AspectRatio ratio={4 / 3}>
                <Tile tone="strong">Cover</Tile>
              </AspectRatio>
            </Stack>
          </ResponsiveStack>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Responsive form actions" description="Full-width buttons stacked on phones; a right-aligned row from sm.">
        <ResponsiveFrame defaultPreset="Phone">
          <ResponsiveStack from="sm" gap={2} isReversedWhenStacked>
            <Button label="Cancel" width="100%" />
            <Button label="Submit bid" variant="primary" width="100%" />
          </ResponsiveStack>
        </ResponsiveFrame>
        <Caption>Stacked, the primary action sits on top where a thumb reaches first.</Caption>
      </Preview>

      <Preview label="Nested stacks" description="Real layouts are stacks inside stacks.">
        <Card padding={4}>
          <VStack gap={4}>
            <HStack hAlign="between" vAlign="center">
              <Text weight="semibold">Invite bidders</Text>
              <Button label="Close" variant="ghost" size="sm" isIconOnly icon={<Icon icon={icons.close} />} />
            </HStack>
            <VStack gap={2}>
              {["Jordan Mills", "Alex Kim", "Riley Chen"].map((name) => (
                <HStack key={name} gap={3} vAlign="center" hAlign="between">
                  <Text>{name}</Text>
                  <Button label="Invite" size="sm" />
                </HStack>
              ))}
            </VStack>
          </VStack>
        </Card>
      </Preview>
    </Examples>
  );
}
