"use client";

import { Button, Card, HStack, Heading, Icon, Stack, Text, icons, type HeadingLevel, type TextColor } from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const LEVELS: HeadingLevel[] = [1, 2, 3, 4, 5, 6];
const DISPLAY = ["display-1", "display-2", "display-3"] as const;
const COLORS: TextColor[] = ["primary", "secondary", "accent", "disabled"];
const WEIGHTS = ["normal", "medium", "semibold", "bold"] as const;
const TRUNCATE_WIDTH = 320;

export default function HeadingDemo() {
  return (
    <Examples>
      <Preview label="Levels" description="level sets both the tag and the size — h1 through h6.">
        <Stack gap={2}>
          {LEVELS.map((level) => (
            <Heading key={level} level={level}>
              Heading {level} — Brand refresh brief
            </Heading>
          ))}
        </Stack>
      </Preview>

      <Preview label="Display types" description="type lifts a heading to the display scale for heroes, without changing its level.">
        <Stack gap={3}>
          {DISPLAY.map((type) => (
            <Heading key={type} level={1} type={type}>
              {type}
            </Heading>
          ))}
        </Stack>
      </Preview>

      <Preview label="Accessibility level" description="Keep the look of one level and announce another to fit the document outline.">
        <Stack gap={2}>
          <Heading level={2} accessibilityLevel={3}>
            Looks like h2, announced as h3
          </Heading>
          <Heading level={5} accessibilityLevel={2}>
            Looks like h5, announced as h2
          </Heading>
        </Stack>
      </Preview>

      <Preview label="Weights">
        <Stack gap={2}>
          {WEIGHTS.map((weight) => (
            <Heading key={weight} level={3} weight={weight}>
              {weight}
            </Heading>
          ))}
        </Stack>
      </Preview>

      <Preview label="Colors">
        <Stack gap={2}>
          {COLORS.map((color) => (
            <Heading key={color} level={3} color={color}>
              {color}
            </Heading>
          ))}
        </Stack>
      </Preview>

      <Preview label="Truncation" description="maxLines clamps long titles; hasTruncateTooltip shows the full text on hover.">
        <Stack gap={3} maxWidth={TRUNCATE_WIDTH}>
          <Heading level={3} maxLines={1} hasTruncateTooltip>
            Full identity refresh for a regional coffee roaster, including packaging and signage
          </Heading>
          <Heading level={3} maxLines={2}>
            Full identity refresh for a regional coffee roaster, including packaging, signage, and a new website
          </Heading>
        </Stack>
      </Preview>

      <Preview label="Wrapping and alignment" description="textWrap=&quot;balance&quot; evens out lines; justify centers hero titles.">
        <Stack gap={4} maxWidth={420}>
          <Heading level={2}>Collect sealed bids from the people you already trust</Heading>
          <Heading level={2} textWrap="balance">
            Collect sealed bids from the people you already trust
          </Heading>
          <Heading level={2} textWrap="balance" justify="center">
            Collect sealed bids from the people you already trust
          </Heading>
        </Stack>
      </Preview>

      <Preview label="Strikethrough">
        <Heading level={4} hasStrikethrough color="secondary">
          Draft: logo options round 1
        </Heading>
      </Preview>

      <Preview label="Page header" description="A heading with supporting copy and actions — the top of most screens.">
        <HStack hAlign="between" vAlign="start" gap={3} wrap="wrap">
          <Stack gap={1}>
            <Heading level={1}>Rooms</Heading>
            <Text color="secondary">Everything you’ve posted, newest first.</Text>
          </Stack>
          <HStack gap={2}>
            <Button label="Export" variant="secondary" icon={<Icon icon={icons.download} />} />
            <Button label="Post a room" variant="primary" icon={<Icon icon={icons.plus} />} />
          </HStack>
        </HStack>
      </Preview>

      <Preview label="Card titles" description="Smaller levels title cards and sections inside a page.">
        <HStack gap={3} wrap="wrap" vAlign="stretch">
          {["Scope", "Budget", "Timeline"].map((title) => (
            <Card key={title} width={200}>
              <Stack gap={1}>
                <Heading level={4}>{title}</Heading>
                <Text type="supporting" color="secondary">
                  Summarized for bidders.
                </Text>
              </Stack>
            </Card>
          ))}
        </HStack>
      </Preview>
    </Examples>
  );
}
