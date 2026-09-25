"use client";

import { AspectRatio, Grid, GridColumn, GridSystem, HStack, ResponsiveFrame, Stack, Text, Tile, type AspectRatioFit } from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const RATIOS = [
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "21:9", ratio: 21 / 9 },
];
const FITS: AspectRatioFit[] = ["cover", "contain", "center"];
const ROOMS = ["Brand refresh", "Landing page", "Motion system", "Pitch deck", "Icon set", "Onboarding"];

export default function AspectRatioDemo() {
  return (
    <Examples>
      <Preview label="Common ratios" description="The box keeps its shape at any width — content fills it.">
        <Grid columns={{ minWidth: 140 }} gap={3}>
          {RATIOS.map(({ label, ratio }) => (
            <Stack key={label} gap={1}>
              <AspectRatio ratio={ratio}>
                <Tile tone="strong">{label}</Tile>
              </AspectRatio>
            </Stack>
          ))}
        </Grid>
      </Preview>

      <Preview label="Portrait" description="Stories and posters run taller than wide.">
        <HStack gap={3} vAlign="end">
          {[
            { label: "9:16", ratio: 9 / 16 },
            { label: "2:3", ratio: 2 / 3 },
            { label: "4:5", ratio: 4 / 5 },
          ].map(({ label, ratio }) => (
            <Stack key={label} width={120}>
              <AspectRatio ratio={ratio}>
                <Tile tone="neutral">{label}</Tile>
              </AspectRatio>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview label="Ellipse" description="shape ellipse crops to a circle at 1:1 — avatars and badges.">
        <HStack gap={3} vAlign="center">
          {[48, 72, 96].map((size) => (
            <Stack key={size} width={size}>
              <AspectRatio ratio={1} shape="ellipse">
                <Tile tone="strong">{size}</Tile>
              </AspectRatio>
            </Stack>
          ))}
          <Stack width={160}>
            <AspectRatio ratio={16 / 9} shape="ellipse">
              <Tile>16:9</Tile>
            </AspectRatio>
          </Stack>
        </HStack>
      </Preview>

      <Preview label="Fit" description="cover fills and crops, contain letterboxes, center keeps the child's own size.">
        <HStack gap={3} wrap="wrap">
          {FITS.map((fit) => (
            <Stack key={fit} gap={1} width={180}>
              <AspectRatio ratio={16 / 9} fit={fit}>
                <Tile tone="neutral" height={140}>
                  {fit}
                </Tile>
              </AspectRatio>
              <Text type="supporting" color="secondary">
                fit “{fit}”
              </Text>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview label="Responsive gallery" description="Thumbnails stay 4:3 while the grid goes 1 → 2 → 3 across.">
        <ResponsiveFrame defaultPreset="Tablet">
          <GridSystem gap={3}>
            {ROOMS.map((name) => (
              <GridColumn key={name} span={12} sm={6} md={4}>
                <Stack gap={1}>
                  <AspectRatio ratio={4 / 3}>
                    <Tile tone="neutral">Cover</Tile>
                  </AspectRatio>
                  <Text weight="medium">{name}</Text>
                </Stack>
              </GridColumn>
            ))}
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Responsive hero" description="A wide banner that keeps 21:9 from phone to laptop.">
        <ResponsiveFrame defaultPreset="Fill">
          <AspectRatio ratio={21 / 9}>
            <Tile tone="strong">Post a sealed room in minutes</Tile>
          </AspectRatio>
        </ResponsiveFrame>
      </Preview>
    </Examples>
  );
}
