"use client";

import {
  Badge,
  Button,
  Card,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Layout,
  LayoutContent,
  LayoutHeader,
  List,
  ListItem,
  ProgressBar,
  ScrollableArea,
  SelectableCard,
  Stack,
  Sticky,
  Text,
  TextInput,
  Tile,
} from "@openseat/design-system";
import { useState } from "react";

import { Caption, Examples, Preview } from "./shared";

/** The demos scroll inside a fixed frame so Sticky has something to stick in. */
const FRAME_HEIGHT = 420;
const ITEMS = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  title: ["Brand refresh", "Landing page", "Motion system", "Pitch deck"][i % 4],
  meta: `${(i % 3) + 1} bids · ${i + 2}d left`,
}));
const FIELDS = [
  "Title",
  "Budget",
  "Deadline",
  "Brief",
  "Deliverables",
  "Reviewers",
  "Tags",
  "Notes",
];

export default function StickyDemo() {
  const [selected, setSelected] = useState(ITEMS[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const current = ITEMS.find((item) => item.id === selected) ?? ITEMS[0];
  const filled = FIELDS.filter((field) => values[field]?.trim()).length;

  return (
    <Examples>
      <Preview
        label="Detail beside a list"
        description="fill sizes the pane to the visible scroll area; its header stays put and the body scrolls inside."
      >
        <ScrollableArea label="List and detail" height={FRAME_HEIGHT} stickyContainment="always">
          <GridSystem gap={3}>
            <GridColumn span={5}>
              <Stack gap={2}>
                {ITEMS.map((item) => (
                  <SelectableCard
                    key={item.id}
                    label={item.title}
                    isSelected={item.id === selected}
                    onChange={() => setSelected(item.id)}
                    padding={3}
                  >
                    <Text weight="semibold">
                      {item.title} #{item.id}
                    </Text>
                    <Caption>{item.meta}</Caption>
                  </SelectableCard>
                ))}
              </Stack>
            </GridColumn>
            <GridColumn span={7}>
              <Sticky fill>
                <Card padding={0}>
                  <Layout
                    height="fill"
                    header={
                      <LayoutHeader hasDivider padding={4}>
                        <HStack hAlign="between" vAlign="center" gap={2}>
                          <Heading level={4}>
                            {current.title} #{current.id}
                          </Heading>
                          <Button label="Place bid" variant="primary" size="sm" />
                        </HStack>
                      </LayoutHeader>
                    }
                    content={
                      <LayoutContent isScrollable padding={4} label="Room detail">
                        <Stack gap={3}>
                          {Array.from({ length: 8 }, (_, i) => (
                            <Tile key={i} meta="Scrolls inside the pane">
                              Section {i + 1}
                            </Tile>
                          ))}
                        </Stack>
                      </LayoutContent>
                    }
                  />
                </Card>
              </Sticky>
            </GridColumn>
          </GridSystem>
        </ScrollableArea>
      </Preview>

      <Preview
        label="Summary beside a form"
        description="Without fill, a short panel simply stays in view. offset keeps a gap above it."
      >
        <ScrollableArea label="Form and summary" height={FRAME_HEIGHT} stickyContainment="always">
          <GridSystem gap={4}>
            <GridColumn span={7}>
              <Stack gap={3}>
                {FIELDS.map((field) => (
                  <TextInput
                    key={field}
                    label={field}
                    value={values[field] ?? ""}
                    onChange={(value) => setValues((all) => ({ ...all, [field]: value }))}
                  />
                ))}
              </Stack>
            </GridColumn>
            <GridColumn span={5}>
              <Sticky offset={2}>
                <Card variant="muted">
                  <Stack gap={3}>
                    <HStack hAlign="between" vAlign="center">
                      <Heading level={4}>New room</Heading>
                      <Badge label="Draft" variant="neutral" />
                    </HStack>
                    <ProgressBar
                      label="Fields filled"
                      value={filled}
                      max={FIELDS.length}
                      hasValueLabel
                    />
                    <List density="compact">
                      <ListItem label="Visibility" description="Sealed bids" />
                      <ListItem label="Reviewers" description={values.Reviewers || "None yet"} />
                    </List>
                    <Button label="Publish" variant="primary" isDisabled={filled < FIELDS.length} />
                  </Stack>
                </Card>
              </Sticky>
            </GridColumn>
          </GridSystem>
        </ScrollableArea>
      </Preview>
    </Examples>
  );
}
