"use client";

import { useRef } from "react";
import {
  CONTAINER_TIERS,
  Grid,
  GridColumn,
  GridSpan,
  GridSystem,
  ResponsiveFrame,
  Show,
  Text,
  Tile,
  VIEWPORT_TIERS,
  useContainerBreakpoint,
  useViewportBreakpoint,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const GALLERY = ["Brand refresh", "Landing page", "Motion system", "Pitch deck", "Icon set", "Onboarding", "Email kit", "Docs site"];
const KPIS = [
  { label: "Open rooms", value: "24" },
  { label: "Bids this week", value: "138" },
  { label: "Avg. budget", value: "$2.1k" },
  { label: "Awarded", value: "11" },
];

function TierReadout() {
  const ref = useRef<HTMLDivElement>(null);
  const tier = useContainerBreakpoint(ref);
  const viewport = useViewportBreakpoint();
  return (
    <div ref={ref}>
      <Text type="supporting" color="secondary">
        Container tier: <strong>{tier}</strong> · viewport tier: <strong>{viewport}</strong>
      </Text>
    </div>
  );
}

export default function GridDemo() {
  return (
    <Examples>
      <Preview
        label="Page layout — resize to reflow"
        description="Phone stacks everything. Tablet puts nav beside content. Laptop adds the aside. Drag the right edge or pick a device."
      >
        <ResponsiveFrame defaultPreset="Laptop">
          <GridSystem gap={3}>
            <GridColumn span="full">
              <Tile tone="strong" meta="span full">Header</Tile>
            </GridColumn>
            <GridColumn span={12} md={4} lg={3}>
              <Tile meta="12 · md 4 · lg 3" height={140}>Navigation</Tile>
            </GridColumn>
            <GridColumn span={12} md={8} lg={6}>
              <Tile meta="12 · md 8 · lg 6" height={140}>Content</Tile>
            </GridColumn>
            <GridColumn span="hidden" lg={3}>
              <Tile tone="neutral" meta="hidden · lg 3" height={140}>Aside</Tile>
            </GridColumn>
            <GridColumn span="full">
              <Tile tone="neutral" meta="span full">Footer</Tile>
            </GridColumn>
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Card gallery — 1, 2, 3, then 4 across" description="span 12 → sm 6 → md 4 → lg 3.">
        <ResponsiveFrame defaultPreset="Tablet">
          <GridSystem gap={3}>
            {GALLERY.map((name) => (
              <GridColumn key={name} span={12} sm={6} md={4} lg={3}>
                <Tile height={88}>{name}</Tile>
              </GridColumn>
            ))}
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Dashboard" description="KPIs go 1 → 2 → 4 across; the chart and list sit side by side from lg.">
        <ResponsiveFrame defaultPreset="Laptop">
          <GridSystem gap={3}>
            {KPIS.map((kpi) => (
              <GridColumn key={kpi.label} span={12} sm={6} lg={3}>
                <Tile tone="neutral" meta={kpi.label}>
                  <Text type="large" weight="semibold">
                    {kpi.value}
                  </Text>
                </Tile>
              </GridColumn>
            ))}
            <GridColumn span={12} lg={8}>
              <Tile height={180} meta="12 · lg 8">Bids over time</Tile>
            </GridColumn>
            <GridColumn span={12} lg={4}>
              <Tile height={180} tone="neutral" meta="12 · lg 4">Top bidders</Tile>
            </GridColumn>
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Reorder per tier" description="On phones the summary comes first; from md it moves to the side.">
        <ResponsiveFrame defaultPreset="Phone">
          <GridSystem gap={3}>
            <GridColumn span={12} md={8} order={{ base: 2, md: 1 }}>
              <Tile height={120} meta="order 2 → md 1">Bid details</Tile>
            </GridColumn>
            <GridColumn span={12} md={4} order={{ base: 1, md: 2 }}>
              <Tile tone="strong" height={120} meta="order 1 → md 2">Summary & award</Tile>
            </GridColumn>
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Centered reading column" description="Full width on phones, 8 of 12 on tablets, 6 of 12 on laptops — always centered via start.">
        <ResponsiveFrame defaultPreset="Laptop">
          <GridSystem gap={3}>
            <GridColumn span={12} md={8} lg={6} start={{ base: 1, md: 3, lg: 4 }}>
              <Tile height={100} meta="start 1 · md 3 · lg 4">Article</Tile>
            </GridColumn>
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Show and hide by tier" description="Inside any responsive container, Show renders a range of tiers without JavaScript.">
        <ResponsiveFrame defaultPreset="Tablet">
          <GridSystem gap={3}>
            <GridColumn span={12}>
              <Show below="md">
                <Tile tone="strong">Compact header — below md</Tile>
              </Show>
              <Show from="md">
                <Tile tone="strong">Full header with search and filters — md and up</Tile>
              </Show>
            </GridColumn>
            <GridColumn span={6} md={4}>
              <Tile height={80}>Always</Tile>
            </GridColumn>
            <GridColumn span={6} md={4}>
              <Tile height={80}>Always</Tile>
            </GridColumn>
            <GridColumn span="hidden" md={4}>
              <Tile tone="neutral" height={80}>md and up</Tile>
            </GridColumn>
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Nested grids" description="Every GridSystem measures itself, so an inner grid reflows by its own column's width.">
        <ResponsiveFrame defaultPreset="Laptop">
          <GridSystem gap={3}>
            <GridColumn span={12} lg={8}>
              <GridSystem gap={2}>
                {["A", "B", "C", "D"].map((cell) => (
                  <GridColumn key={cell} span={12} sm={6}>
                    <Tile tone="neutral" meta="inner 12 · sm 6">
                      {cell}
                    </Tile>
                  </GridColumn>
                ))}
              </GridSystem>
            </GridColumn>
            <GridColumn span={12} lg={4}>
              <Tile height={120} meta="outer 12 · lg 4">Sidebar</Tile>
            </GridColumn>
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview
        label="Intrinsic — Astryx Grid with a minimum width"
        description="No breakpoints at all: columns={{ minWidth: 160 }} fits as many 160px+ tracks as the width allows."
      >
        <ResponsiveFrame defaultPreset="Tablet">
          <Grid columns={{ minWidth: 160 }} gap={3}>
            {GALLERY.map((name) => (
              <Tile key={name} height={72}>
                {name}
              </Tile>
            ))}
          </Grid>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Intrinsic, capped" description="max: 3 stops rows from getting too wide; repeat: fit stretches leftover space.">
        <ResponsiveFrame defaultPreset="Fill">
          <Grid columns={{ minWidth: 140, max: 3, repeat: "fit" }} gap={3}>
            {GALLERY.slice(0, 5).map((name) => (
              <Tile key={name} tone="neutral" height={64}>
                {name}
              </Tile>
            ))}
          </Grid>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Bento — spans across rows and columns" description="Astryx Grid with GridSpan for featured cells.">
        <Grid columns={4} gap={3} rowHeight={72}>
          <GridSpan columns={2} rows={2}>
            <Tile tone="strong" meta="2 × 2">Featured room</Tile>
          </GridSpan>
          <Tile>Bids</Tile>
          <Tile tone="neutral">Views</Tile>
          <GridSpan columns={2}>
            <Tile meta="2 × 1">Timeline</Tile>
          </GridSpan>
          <GridSpan columns="full">
            <Tile tone="neutral" meta="full row">Activity</Tile>
          </GridSpan>
        </Grid>
      </Preview>

      <Preview label="Dense packing" description="dense backfills gaps left by wide cells.">
        <ResponsiveFrame defaultPreset="Fill">
          <GridSystem gap={2} dense>
            {[8, 4, 6, 3, 9, 4, 4, 4].map((span, index) => (
              <GridColumn key={index} span={12} sm={span}>
                <Tile tone={index % 2 ? "neutral" : "accent"} meta={`sm ${span}`}>
                  {index + 1}
                </Tile>
              </GridColumn>
            ))}
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview
        label="Container or viewport"
        description="Container mode (default) reads the grid's own width — right for cards, panels, and sidebars. Viewport mode reads the window, using Astryx breakpoints."
      >
        <ResponsiveFrame defaultPreset="Tablet">
          <GridSystem gap={3}>
            <GridColumn span={12}>
              <TierReadout />
            </GridColumn>
            <GridColumn span={12} md={6}>
              <Tile meta="responsiveTo container">Follows this frame</Tile>
            </GridColumn>
            <GridColumn span={12} md={6}>
              <GridSystem gap={2} responsiveTo="viewport">
                <GridColumn span={12} md={6}>
                  <Tile tone="neutral" meta="viewport md 6">Follows window</Tile>
                </GridColumn>
                <GridColumn span={12} md={6}>
                  <Tile tone="neutral" meta="viewport md 6">Follows window</Tile>
                </GridColumn>
              </GridSystem>
            </GridColumn>
          </GridSystem>
        </ResponsiveFrame>
        <Caption>
          Container tiers: sm {CONTAINER_TIERS.sm} · md {CONTAINER_TIERS.md} · lg {CONTAINER_TIERS.lg} · xl {CONTAINER_TIERS.xl}px. Viewport
          tiers (Astryx): sm {VIEWPORT_TIERS.sm} · md {VIEWPORT_TIERS.md} · lg {VIEWPORT_TIERS.lg} · xl {VIEWPORT_TIERS.xl}px.
        </Caption>
      </Preview>
    </Examples>
  );
}
