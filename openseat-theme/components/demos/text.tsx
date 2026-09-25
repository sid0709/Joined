"use client";

import { HStack, Stack, Text, type TextColor, type TextType } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const TYPES: TextType[] = ["display-1", "display-2", "display-3", "large", "body", "label", "supporting", "code"];
const SIZES = ["4xs", "3xs", "2xs", "xsm", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const;
const WEIGHTS = ["normal", "medium", "semibold", "bold"] as const;
const COLORS: TextColor[] = ["primary", "secondary", "accent", "placeholder", "disabled"];
const LONG =
  "Invited people can see this room, the brief, and the deadline. Their bids stay sealed until the room closes, then every bid is revealed at once so you can compare them side by side.";
const NARROW = 320;
const PRICES = ["$2,400.00", "$11,150.50", "$980.25", "$14,111.00"];

export default function TextDemo() {
  return (
    <Examples>
      <Preview label="Types" description="type sets size, weight, and line height together. Prefer it over size.">
        <Stack gap={3}>
          {TYPES.map((type) => (
            <HStack key={type} gap={3} vAlign="center" wrap="wrap">
              <Stack width={96}>
                <Caption>{type}</Caption>
              </Stack>
              <Text type={type}>Sealed bids, fair prices</Text>
            </HStack>
          ))}
        </Stack>
      </Preview>

      <Preview label="Size override" description="size changes only the font size and keeps the type’s other traits.">
        <Stack gap={2}>
          {SIZES.map((size) => (
            <HStack key={size} gap={3} vAlign="center">
              <Stack width={96}>
                <Caption>{size}</Caption>
              </Stack>
              <Text size={size}>The quick brown fox</Text>
            </HStack>
          ))}
        </Stack>
      </Preview>

      <Preview label="Weights">
        <Stack gap={1}>
          {WEIGHTS.map((weight) => (
            <Text key={weight} weight={weight} display="block">
              {weight} — Invite two people to bid
            </Text>
          ))}
        </Stack>
      </Preview>

      <Preview label="Colors" description="primary for content, secondary for support, accent sparingly, placeholder and disabled for empty and inactive.">
        <Stack gap={1}>
          {COLORS.map((color) => (
            <Text key={color} color={color} display="block">
              {color} — Closes Friday at 5 PM
            </Text>
          ))}
        </Stack>
      </Preview>

      <Preview label="Display" description="Text is inline by default; display=&quot;block&quot; puts it on its own line.">
        <Stack gap={2}>
          <div>
            <Text>Inline one.</Text> <Text color="secondary">Inline two.</Text>
          </div>
          <div>
            <Text display="block">Block one.</Text>
            <Text display="block" color="secondary">
              Block two.
            </Text>
          </div>
        </Stack>
      </Preview>

      <Preview label="Truncation" description="maxLines clamps with an ellipsis; hasTruncateTooltip reveals the rest on hover.">
        <Stack gap={3} maxWidth={NARROW}>
          <Text maxLines={1} hasTruncateTooltip display="block">
            {LONG}
          </Text>
          <Text maxLines={2} display="block">
            {LONG}
          </Text>
          <Text maxLines={3} hasTruncateTooltip="below" display="block">
            {LONG}
          </Text>
        </Stack>
      </Preview>

      <Preview label="Wrapping" description="balance evens out short blocks; pretty avoids a lonely last word; nowrap keeps one line.">
        <Stack gap={3} maxWidth={NARROW}>
          <Text textWrap="balance" display="block">
            {LONG}
          </Text>
          <Text textWrap="pretty" display="block">
            {LONG}
          </Text>
          <Text textWrap="nowrap" display="block" maxLines={1}>
            {LONG}
          </Text>
        </Stack>
      </Preview>

      <Preview label="Word break" description="For long IDs, URLs, and hashes in narrow columns.">
        <Stack gap={2} maxWidth={200}>
          <Text wordBreak="break-word" display="block">
            room_1043_c1f2a9b8e7d6f5a4b3c2d1e0
          </Text>
          <Text wordBreak="break-all" display="block">
            https://openseat.example/rooms/1043/bids/compare
          </Text>
        </Stack>
      </Preview>

      <Preview label="Alignment">
        <Stack gap={2}>
          <Text justify="start" display="block">
            Start
          </Text>
          <Text justify="center" display="block">
            Center
          </Text>
          <Text justify="end" display="block">
            End
          </Text>
        </Stack>
      </Preview>

      <Preview label="Tabular numbers" description="hasTabularNumbers lines up digits in tables and totals.">
        <HStack gap={6}>
          <Stack gap={1} hAlign="end">
            <Caption>Default</Caption>
            {PRICES.map((price) => (
              <Text key={price}>{price}</Text>
            ))}
          </Stack>
          <Stack gap={1} hAlign="end">
            <Caption>Tabular</Caption>
            {PRICES.map((price) => (
              <Text key={price} hasTabularNumbers>
                {price}
              </Text>
            ))}
          </Stack>
        </HStack>
      </Preview>

      <Preview label="Strikethrough">
        <HStack gap={2} vAlign="center">
          <Text hasStrikethrough color="secondary">
            $2,900
          </Text>
          <Text weight="semibold">$2,400</Text>
        </HStack>
      </Preview>

      <Preview label="Semantic element" description="as picks the tag — p for paragraphs, label for form captions — without changing the look.">
        <Stack gap={2}>
          <Text as="p">Rendered as a paragraph.</Text>
          <Text as="label" type="label">
            Rendered as a label
          </Text>
          <Text as="div" type="supporting" color="secondary">
            Rendered as a div.
          </Text>
        </Stack>
      </Preview>
    </Examples>
  );
}
