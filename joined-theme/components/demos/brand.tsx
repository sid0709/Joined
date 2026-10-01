"use client";

import {
  BRAND_NAME,
  HStack,
  JoinedLogo,
  JoinedMark,
  Nav,
  Stack,
  TopNav,
  TopNavHeading,
  type JoinedLogoVariant,
  type JoinedMarkVariant,
} from "@joined/design-system";

import { Caption, Examples, Preview, Row } from "./shared";

const LOGO_VARIANTS: JoinedLogoVariant[] = [
  "original",
  "blue-gradient",
  "meta-blue",
  "black",
  "white",
];
const MARK_VARIANTS: JoinedMarkVariant[] = ["app", "gradient", "meta-blue", "white"];
const MARK_SIZES = ["1rem", "1.5rem", "2rem", "3rem"] as const;

export default function BrandDemo() {
  return (
    <Examples>
      <Preview
        align="start"
        label="Wordmark"
        description="JoinedLogo. original is the primary mark; white is for dark or accent surfaces — switch the docs to Dark to see it."
      >
        <Stack gap={4} hAlign="start">
          {LOGO_VARIANTS.map((variant) => (
            <Stack key={variant} gap={1} hAlign="start">
              <JoinedLogo variant={variant} height="2.5rem" />
              <Caption>{variant}</Caption>
            </Stack>
          ))}
        </Stack>
      </Preview>

      <Preview
        align="start"
        label="App icon and symbol"
        description="JoinedMark. app is the rounded tile used for favicons and home-screen icons; the bare symbol fits tight spaces."
      >
        <HStack gap={6} wrap="wrap">
          {MARK_VARIANTS.map((variant) => (
            <Stack key={variant} gap={1} hAlign="center">
              <JoinedMark variant={variant} size="3rem" />
              <Caption>{variant}</Caption>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Sizes" description="Height drives both marks; width follows.">
        <Row>
          {MARK_SIZES.map((size) => (
            <JoinedMark key={size} size={size} />
          ))}
        </Row>
      </Preview>

      <Preview
        label="In a top bar"
        description="Nav shows the wordmark for the bare brand, and the app icon beside a sub-product name."
      >
        <Stack gap={3}>
          <Nav items={[{ label: "Rooms", active: true }, { label: "Bids" }]} cta="Post a room" />
          <Nav brand={`${BRAND_NAME} Marketplace`} items={[{ label: "Jobs", active: true }]} />
          <TopNav
            label="Workspace"
            heading={
              <TopNavHeading
                logo={<JoinedMark label="" />}
                superheading="Northwind"
                heading="Rooms"
              />
            }
          />
        </Stack>
      </Preview>
    </Examples>
  );
}
