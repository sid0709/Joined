"use client";

import {
  HStack,
  JoinedLogo,
  JoinedMark,
  List,
  ListItem,
  Stack,
  Table,
  Text,
  type JoinedLogoVariant,
  type JoinedMarkVariant,
  type TableColumn,
} from "sid-ui";

import { Caption, Examples, Preview, Row } from "./shared";

const LOGO_VARIANTS: { variant: JoinedLogoVariant; use: string }[] = [
  { variant: "blue", use: "Default. Product chrome, auth, docs — light and dark." },
  { variant: "blue-gradient", use: "The fixed artwork, for print and exports." },
  { variant: "meta-blue", use: "One flat blue, where gradients render poorly." },
  { variant: "original", use: "Marketing moments only — never in product chrome." },
  { variant: "black", use: "Single-color print on light paper." },
  { variant: "white", use: "On the accent, photos, or other strong fills." },
];
const MARK_VARIANTS: { variant: JoinedMarkVariant; use: string }[] = [
  { variant: "app", use: "App icon, favicon, product headings" },
  { variant: "blue", use: "Bare symbol, inline" },
  { variant: "gradient", use: "Bare symbol, fixed" },
  { variant: "meta-blue", use: "Flat" },
  { variant: "white", use: "On fills" },
];
const MARK_SIZES = ["1rem", "1.5rem", "2rem", "3rem"] as const;

type Placement = { place: string; logo: string; component: string };

const PLACEMENTS: Placement[] = [
  {
    place: "Top bar — job platform, marketplace, docs",
    logo: "Blue wordmark",
    component: "BrandHeading",
  },
  {
    place: "Top bar — Scoutwell, Joined Admin",
    logo: "App icon + product name",
    component: 'BrandHeading product="…"',
  },
  {
    place: "Sign in, sign up, onboarding",
    logo: "Lockup + tagline",
    component: "BrandLockup",
  },
  { place: "404 and error pages", logo: "Lockup", component: "BrandLockup" },
  { place: "Landing and auth page footers", logo: "Sign-off", component: "BrandFooter" },
  {
    place: "Browser tab, home screen",
    logo: "App icon tile",
    component: "app/favicon.ico · icon.svg · apple-icon.png (bun run brand:icons)",
  },
  { place: "Accent or photo surface", logo: "White wordmark", component: 'variant="white"' },
  {
    place: "Marketing hero, social cards",
    logo: "Original colors",
    component: 'variant="original"',
  },
];

const PLACEMENT_COLUMNS: TableColumn<Placement>[] = [
  { key: "place", header: "Where" },
  { key: "logo", header: "Logo" },
  { key: "component", header: "How" },
];

const DO = [
  "Lead with blue. The default JoinedLogo and JoinedMark are already the right choice.",
  "Use the shared components — BrandHeading, BrandLockup, BrandFooter — so every app matches.",
  "Keep clear space around the wordmark at least the height of the dot on the i.",
  "Size by height only; width follows the artwork.",
];
const DONT = [
  "Type “Joined” in a heading font in place of the wordmark.",
  "Recolor, stretch, rotate, outline, or add shadows to the artwork.",
  "Put the blue logo on the blue accent — switch to white.",
  "Use the original colors in product chrome; they are for marketing moments.",
  "Go below 16px tall for the wordmark or the app icon, or 12px for the bare symbol.",
];

export default function BrandDemo() {
  return (
    <Examples>
      <Preview
        align="start"
        label="Blue first"
        description="Blue is Joined's everyday color. The default wordmark is the blue gradient; in dark mode it steps one stop brighter so the navy end stays legible."
      >
        <HStack gap={6} wrap="wrap" vAlign="center">
          <JoinedLogo height="3rem" />
          <JoinedMark size="3rem" />
        </HStack>
      </Preview>

      <Preview
        align="start"
        label="Wordmark"
        description="JoinedLogo. Pick the variant for the surface; switch the docs to Dark to check white."
      >
        <Stack gap={4} hAlign="start">
          {LOGO_VARIANTS.map(({ variant, use }) => (
            <Stack key={variant} gap={1} hAlign="start">
              <JoinedLogo variant={variant} height="2.5rem" />
              <Caption>
                {variant} — {use}
              </Caption>
            </Stack>
          ))}
        </Stack>
      </Preview>

      <Preview
        align="start"
        label="App icon and symbol"
        description="JoinedMark. app is the rounded tile used for favicons, home screens, and product headings; the bare symbol fits tight inline spaces."
      >
        <HStack gap={6} wrap="wrap">
          {MARK_VARIANTS.map(({ variant, use }) => (
            <Stack key={variant} gap={1} hAlign="center" width={112}>
              <JoinedMark variant={variant} size="3rem" />
              <Caption>{variant}</Caption>
              <Caption>{use}</Caption>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Sizes" description="Height drives both marks; width follows.">
        <Row>
          {MARK_SIZES.map((size) => (
            <JoinedMark key={size} size={size} />
          ))}
          {MARK_SIZES.map((size) => (
            <JoinedLogo key={size} height={size} />
          ))}
        </Row>
      </Preview>

      <Preview label="Which logo goes where" description="Every app follows this map.">
        <Table
          columns={PLACEMENT_COLUMNS}
          rows={PLACEMENTS}
          rowKey={(row) => row.place}
          density="compact"
        />
      </Preview>

      <Preview label="Do">
        <List>
          {DO.map((rule) => (
            <ListItem key={rule} label={rule} />
          ))}
        </List>
      </Preview>

      <Preview label="Don’t">
        <Stack gap={2}>
          <List>
            {DONT.map((rule) => (
              <ListItem key={rule} label={rule} />
            ))}
          </List>
          <Text type="supporting" color="secondary">
            Masters live in Joined-Logo/ at the repo root. Change the artwork there, then run bun
            run brand:icons.
          </Text>
        </Stack>
      </Preview>
    </Examples>
  );
}
