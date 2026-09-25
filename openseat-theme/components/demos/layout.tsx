"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  Card,
  GridColumn,
  GridSystem,
  HStack,
  Hide,
  Icon,
  IconButton,
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutHeader,
  LayoutPanel,
  ResponsiveFrame,
  Show,
  Stack,
  Text,
  Tile,
  icons,
  useResizable,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const MESSAGES = ["Jordan Mills", "Alex Kim", "Riley Chen", "Sam Ortiz", "Taylor Kim", "Morgan Lee", "Casey Park", "Drew Fox"];

function Box({ height = 260, children }: { height?: number; children: ReactNode }) {
  return (
    <Card height={height} padding={0} width="100%">
      {children}
    </Card>
  );
}

function Header({ title }: { title: string }) {
  return (
    <LayoutHeader hasDivider>
      <HStack hAlign="between" vAlign="center">
        <Text weight="semibold">{title}</Text>
        <IconButton label="More" variant="ghost" size="sm" icon={<Icon icon={icons.settings} />} />
      </HStack>
    </LayoutHeader>
  );
}

export default function LayoutDemo() {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(MESSAGES[0]);
  const panel = useResizable({ defaultSize: 200, minSize: 140, maxSize: 320 });

  return (
    <Examples>
      <Preview label="Header, content, footer" description="The body scrolls; header and footer stay put.">
        <Box>
          <Layout
            height="fill"
            header={<Header title="Brand refresh" />}
            content={
              <LayoutContent isScrollable>
                <Stack gap={2}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <Tile key={i} tone="neutral">
                      Bid {i + 1}
                    </Tile>
                  ))}
                </Stack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button label="Close room" variant="ghost" />
                  <Button label="Award" variant="primary" />
                </HStack>
              </LayoutFooter>
            }
          />
        </Box>
      </Preview>

      <Preview label="Start and end panels" description="Side panels frame the content — navigation on the start, details on the end.">
        <Box height={280}>
          <Layout
            height="fill"
            header={<Header title="Inbox" />}
            start={
              <LayoutPanel width={180} hasDivider isScrollable label="Conversations">
                <Stack gap={1}>
                  {MESSAGES.map((name) => (
                    <Button key={name} label={name} variant={name === selected ? "secondary" : "ghost"} width="100%" onClick={() => setSelected(name)} />
                  ))}
                </Stack>
              </LayoutPanel>
            }
            content={
              <LayoutContent>
                <Stack gap={2}>
                  <Text weight="semibold">{selected}</Text>
                  <Text color="secondary">Thanks for the invite — I can start Monday.</Text>
                </Stack>
              </LayoutContent>
            }
            end={
              <LayoutPanel width={160} hasDivider label="Details">
                <Stack gap={1}>
                  <Text type="supporting" color="secondary">
                    Bid
                  </Text>
                  <Text weight="medium">$2,400</Text>
                </Stack>
              </LayoutPanel>
            }
          />
        </Box>
      </Preview>

      <Preview label="Resizable panel" description="Pass useResizable props to a panel and drag its edge.">
        <Box height={220}>
          <Layout
            height="fill"
            start={
              <LayoutPanel width={panel.size} resizable={panel.props} hasDivider label="Files">
                <Tile tone="neutral">{panel.size}px</Tile>
              </LayoutPanel>
            }
            content={
              <LayoutContent>
                <Tile height={120}>Editor</Tile>
              </LayoutContent>
            }
          />
        </Box>
      </Preview>

      <Preview label="Toggle a panel" description="Panels are just slots — render them conditionally.">
        <Stack gap={2}>
          <Box height={200}>
            <Layout
              height="fill"
              header={
                <LayoutHeader hasDivider>
                  <HStack hAlign="between" vAlign="center">
                    <Text weight="semibold">Room</Text>
                    <Button label={open ? "Hide details" : "Show details"} size="sm" onClick={() => setOpen(!open)} />
                  </HStack>
                </LayoutHeader>
              }
              content={
                <LayoutContent>
                  <Tile height={100}>Bids</Tile>
                </LayoutContent>
              }
              end={
                open ? (
                  <LayoutPanel width={180} hasDivider label="Details">
                    <Tile tone="neutral">Details</Tile>
                  </LayoutPanel>
                ) : undefined
              }
            />
          </Box>
        </Stack>
      </Preview>

      <Preview label="Constrained content width" description="contentWidth centers a readable column inside a wide layout.">
        <Box height={200}>
          <Layout
            height="fill"
            contentWidth={420}
            header={<Header title="Article" />}
            content={
              <LayoutContent>
                <Tile height={110} meta="contentWidth 420">
                  Reading column
                </Tile>
              </LayoutContent>
            }
          />
        </Box>
      </Preview>

      <Preview
        label="Responsive — panels become sections"
        description="Show the side panels from md; below that, the same details render inline under the content."
      >
        <ResponsiveFrame defaultPreset="Tablet">
          <Box height={300}>
            <Layout
              height="fill"
              header={<Header title="Brand refresh" />}
              start={
                <Show from="md">
                  <LayoutPanel width={160} hasDivider label="Sections">
                    <Tile tone="neutral">Sections</Tile>
                  </LayoutPanel>
                </Show>
              }
              content={
                <LayoutContent isScrollable>
                  <Stack gap={3}>
                    <GridSystem gap={3}>
                      <GridColumn span={12} lg={6}>
                        <Tile height={90}>Brief</Tile>
                      </GridColumn>
                      <GridColumn span={12} lg={6}>
                        <Tile height={90}>Bids</Tile>
                      </GridColumn>
                    </GridSystem>
                    <Hide from="md">
                      <Tile tone="neutral" meta="inline below md">
                        Sections
                      </Tile>
                    </Hide>
                  </Stack>
                </LayoutContent>
              }
            />
          </Box>
        </ResponsiveFrame>
        <Caption>Show and Hide read the frame, so switching presets moves the Sections panel in and out.</Caption>
      </Preview>
    </Examples>
  );
}
