"use client";

import { useRef } from "react";
import { Button, Card, HStack, ResizeHandle, Stack, Text, Tile, VStack, useResizable } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const PANE_HEIGHT = 200;

export default function ResizeHandleDemo() {
  const side = useResizable({ defaultSize: 200, minSize: 120, maxSize: 360 });
  const bottom = useResizable({ direction: "vertical", defaultSize: 90, minSize: 48, maxSize: 180 });
  const collapsible = useResizable({ defaultSize: 220, minSize: 160, maxSize: 320, collapsible: true, collapsedSize: 48 });
  const snapping = useResizable({ defaultSize: 240, minSize: 120, maxSize: 400, snaps: [160, 240, 320] });
  const containerRef = useRef<HTMLDivElement>(null);
  const split = useResizable({ containerRef, defaultSize: "40%", minSize: "20%", maxSize: "80%" });

  return (
    <Examples>
      <Preview label="Two panes" description="Drag the handle or focus it and use the arrow keys.">
        <Card padding={0} width="100%">
          <HStack height={PANE_HEIGHT}>
            <Stack width={side.size} padding={3}>
              <Tile tone="neutral" meta={`${Math.round(side.size)}px`}>
                Sidebar
              </Tile>
            </Stack>
            <ResizeHandle resizable={side.props} hasDivider label="Resize sidebar" />
            <Stack padding={3} width="100%">
              <Tile meta="fills the rest">Content</Tile>
            </Stack>
          </HStack>
        </Card>
      </Preview>

      <Preview label="Vertical — a bottom panel" description="direction vertical for editors with a console or preview below.">
        <Card padding={0} width="100%">
          <VStack height={260}>
            <Stack padding={3} height="100%">
              <Tile height={60}>Editor</Tile>
            </Stack>
            <ResizeHandle direction="vertical" resizable={bottom.props} hasDivider isReversed label="Resize console" />
            <Stack height={bottom.size} padding={3}>
              <Tile tone="neutral" meta={`${Math.round(bottom.size)}px`}>
                Console
              </Tile>
            </Stack>
          </VStack>
        </Card>
      </Preview>

      <Preview label="Percent of the container" description="Sizes like “40%” are relative to the container, so the split survives window resizes.">
        <Card padding={0} width="100%">
          <HStack height={160} ref={containerRef}>
            <Stack width={split.size} padding={3}>
              <Tile meta="40% default">Left</Tile>
            </Stack>
            <ResizeHandle resizable={split.props} hasDivider label="Resize split" />
            <Stack padding={3} width="100%">
              <Tile tone="neutral">Right</Tile>
            </Stack>
          </HStack>
        </Card>
      </Preview>

      <Preview label="Collapsible" description="Drag past the minimum to collapse to a rail; drag back or use the buttons to restore.">
        <Stack gap={2}>
          <Card padding={0} width="100%">
            <HStack height={180}>
              <Stack width={collapsible.size} padding={collapsible.isCollapsed ? 1 : 3}>
                <Tile tone="neutral">{collapsible.isCollapsed ? "·" : "Navigation"}</Tile>
              </Stack>
              <ResizeHandle resizable={collapsible.props} hasDivider isAlwaysVisible label="Resize navigation" />
              <Stack padding={3} width="100%">
                <Tile>Content</Tile>
              </Stack>
            </HStack>
          </Card>
          <HStack gap={2}>
            <Button label="Collapse" size="sm" onClick={collapsible.collapse} isDisabled={collapsible.isCollapsed} />
            <Button label="Expand" size="sm" onClick={collapsible.expand} isDisabled={!collapsible.isCollapsed} />
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Snap points" description="snaps pulls the size to 160, 240, or 320 when you release near them.">
        <Card padding={0} width="100%">
          <HStack height={140}>
            <Stack width={snapping.size} padding={3}>
              <Tile tone="neutral" meta={`${Math.round(snapping.size)}px`}>
                Panel
              </Tile>
            </Stack>
            <ResizeHandle resizable={snapping.props} hasDivider pillPlacement="center" label="Resize panel" />
            <Stack padding={3} width="100%">
              <Tile>Content</Tile>
            </Stack>
          </HStack>
        </Card>
      </Preview>

      <Preview label="Programmatic sizes">
        <Stack gap={2}>
          <HStack gap={2}>
            {[140, 200, 280, 360].map((size) => (
              <Button key={size} label={`${size}px`} size="sm" onClick={() => side.resize(size)} />
            ))}
          </HStack>
          <Caption>These buttons resize the “Two panes” sidebar above.</Caption>
          <Text type="supporting" color="secondary">
            Current: {Math.round(side.size)}px
          </Text>
        </Stack>
      </Preview>
    </Examples>
  );
}
