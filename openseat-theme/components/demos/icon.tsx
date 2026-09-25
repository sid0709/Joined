"use client";

import {
  Button,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
  icons,
  type GlyphName,
  type IconColor,
  type IconName,
  type IconSize,
} from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const REGISTRY: IconName[] = [
  "check",
  "checkDouble",
  "close",
  "success",
  "error",
  "warning",
  "info",
  "search",
  "funnel",
  "calendar",
  "clock",
  "menu",
  "moreHorizontal",
  "copy",
  "externalLink",
  "chevronLeft",
  "chevronRight",
  "chevronDown",
  "chevronsLeft",
  "chevronsRight",
  "arrowUp",
  "arrowDown",
  "arrowsUpDown",
  "viewColumns",
  "eyeSlash",
  "wrench",
  "stop",
  "microphone",
];
const SIZES: IconSize[] = ["xsm", "sm", "md", "lg"];
const COLORS: IconColor[] = ["primary", "secondary", "tertiary", "disabled", "accent", "success", "warning", "error"];
const PALETTE: IconColor[] = ["blue", "cyan", "green", "red", "gray"];
const GLYPHS = Object.keys(icons) as GlyphName[];

export default function IconDemo() {
  return (
    <Examples>
      <Preview align="start" label="Astryx registry" description="Pass a semantic name; the theme decides the glyph.">
        <HStack gap={4} wrap="wrap">
          {REGISTRY.map((name) => (
            <Stack key={name} gap={1} hAlign="center" width={88}>
              <Icon icon={name} />
              <Caption>{name}</Caption>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="OpenSeat set" description="icons.* covers product actions and is drawn to match Astryx.">
        <HStack gap={4} wrap="wrap">
          {GLYPHS.map((name) => (
            <Stack key={name} gap={1} hAlign="center" width={88}>
              <Icon icon={icons[name]} />
              <Caption>{name}</Caption>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Sizes" description="xsm 12 · sm 16 · md 20 (default) · lg 24.">
        <Stack gap={2} hAlign="start">
          {SIZES.map((size) => (
            <Row key={size}>
              <Icon icon="search" size={size} />
              <Icon icon={icons.heart} size={size} />
              <Icon icon="calendar" size={size} />
              <Icon icon={icons.settings} size={size} />
              <Caption>{size}</Caption>
            </Row>
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Semantic colors" description="Text-like colors for chrome; status colors pair with a word.">
        <Row>
          {COLORS.map((color) => (
            <Stack key={color} gap={1} hAlign="center" width={72}>
              <Icon icon="info" color={color} size="lg" />
              <Caption>{color}</Caption>
            </Stack>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Palette colors" description="For categories and illustrations, not status.">
        <Row>
          {PALETTE.map((color) => (
            <Stack key={color} gap={1} hAlign="center" width={72}>
              <Icon icon={icons.bookmark} color={color} size="lg" />
              <Caption>{color}</Caption>
            </Stack>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Inherit" description="color=&quot;inherit&quot; follows the text around it.">
        <Stack gap={2}>
          <Text color="accent">
            <HStack gap={1} vAlign="center">
              <Icon icon={icons.sparkle} color="inherit" size="sm" />
              Recommended for you
            </HStack>
          </Text>
          <Text color="secondary">
            <HStack gap={1} vAlign="center">
              <Icon icon={icons.lock} color="inherit" size="sm" />
              Only invited people can see this room
            </HStack>
          </Text>
        </Stack>
      </Preview>

      <Preview align="start" label="Status with a word" description="Never color alone — each icon sits next to the state it names.">
        <Stack gap={2}>
          <HStack gap={2} vAlign="center">
            <Icon icon="success" color="success" />
            <Text>Bid submitted</Text>
          </HStack>
          <HStack gap={2} vAlign="center">
            <Icon icon="warning" color="warning" />
            <Text>Closes in 2 hours</Text>
          </HStack>
          <HStack gap={2} vAlign="center">
            <Icon icon="error" color="error" />
            <Text>Payment failed</Text>
          </HStack>
          <HStack gap={2} vAlign="center">
            <Icon icon="info" color="accent" />
            <Text>Bids stay sealed until the deadline</Text>
          </HStack>
        </Stack>
      </Preview>

      <Preview align="start" label="Meaningful vs decorative" description="Add label when the icon is the only thing carrying meaning; leave it off beside text.">
        <Row>
          <Icon icon={icons.lock} label="Sealed room" />
          <Text>
            <HStack gap={1} vAlign="center">
              <Icon icon={icons.lock} size="sm" />
              Sealed
            </HStack>
          </Text>
        </Row>
      </Preview>

      <Preview align="start" label="In controls" description="The same Icon fills every icon slot — buttons, icon buttons, and more.">
        <Row>
          <Button label="Share" icon={<Icon icon={icons.share} />} />
          <Button label="Next" variant="primary" endContent={<Icon icon={icons.arrowRight} />} />
          <IconButton label="Edit" icon={<Icon icon={icons.edit} />} />
          <IconButton label="Delete" variant="destructive" icon={<Icon icon={icons.trash} />} />
          <IconButton label="More" variant="ghost" icon={<Icon icon="moreHorizontal" />} />
        </Row>
      </Preview>
    </Examples>
  );
}
