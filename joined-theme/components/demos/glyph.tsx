"use client";

import { Glyph, HStack, Stack, icons, type GlyphName } from "sid-ui";

import { Caption, Examples, Preview, Row } from "./shared";

const NAMES = Object.keys(icons) as GlyphName[];
const SIZES = [16, 20, 24] as const;

export default function GlyphDemo() {
  return (
    <Examples>
      <Preview
        align="start"
        label="Set"
        description="One 24px grid, 2px stroke, round caps and joins. Pass a name to Glyph, or icons.name to Icon."
      >
        <HStack gap={4} wrap="wrap">
          {NAMES.map((name) => (
            <Stack key={name} gap={1} hAlign="center" width={88}>
              <Glyph name={name} size={24} />
              <Caption>{name}</Caption>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview
        align="start"
        label="Theme"
        description="Sun while the app is dark, moon while it is light. Same stroke as the rest of the set."
      >
        <Row>
          <Stack gap={1} hAlign="center">
            <Glyph name="sun" size={24} />
            <Caption>sun</Caption>
          </Stack>
          <Stack gap={1} hAlign="center">
            <Glyph name="moon" size={24} />
            <Caption>moon</Caption>
          </Stack>
          <Stack gap={1} hAlign="center">
            <Glyph name="settings" size={24} />
            <Caption>settings</Caption>
          </Stack>
        </Row>
      </Preview>

      <Preview
        align="start"
        label="Sizes"
        description="16 in controls, 20 beside labels, 24 on its own."
      >
        <Stack gap={3} hAlign="start">
          {SIZES.map((size) => (
            <Row key={size}>
              <Glyph name="settings" size={size} />
              <Glyph name="sun" size={size} />
              <Glyph name="moon" size={size} />
              <Glyph name="search" size={size} />
              <Caption>{size}</Caption>
            </Row>
          ))}
        </Stack>
      </Preview>
    </Examples>
  );
}
