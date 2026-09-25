"use client";

import { Button, Card, Divider, HStack, Icon, IconButton, Stack, Text, Tile, icons } from "@openseat/design-system";
import { Examples, Preview } from "./shared";

export default function DividerDemo() {
  return (
    <Examples>
      <Preview label="Subtle and strong" description="Subtle separates items in a list; strong marks a real change of region.">
        <Stack gap={3}>
          <Text>Above a subtle divider</Text>
          <Divider variant="subtle" />
          <Text>Between the two</Text>
          <Divider variant="strong" />
          <Text>Below a strong divider</Text>
        </Stack>
      </Preview>

      <Preview label="With a label" description="Labels name the split — often “or” between two ways to sign in.">
        <Stack gap={3} maxWidth={360}>
          <Button label="Continue with email" variant="primary" width="100%" />
          <Divider label="or" />
          <Button label="Continue with a passkey" width="100%" icon={<Icon icon={icons.lock} />} />
        </Stack>
      </Preview>

      <Preview label="Section labels" description="A labeled divider can title a group without a heading.">
        <Stack gap={3}>
          <Divider label="Today" />
          <Text>Jordan joined the room</Text>
          <Text>Alex left a review</Text>
          <Divider label="Yesterday" />
          <Text>Preview shipped</Text>
        </Stack>
      </Preview>

      <Preview label="Vertical" description="Between inline groups in a toolbar or a stat row.">
        <Stack gap={4}>
          <HStack gap={2} vAlign="center" height={32}>
            <IconButton label="Bold" variant="ghost" size="sm" icon={<Icon icon={icons.bold} />} />
            <IconButton label="Italic" variant="ghost" size="sm" icon={<Icon icon={icons.italic} />} />
            <Divider orientation="vertical" />
            <IconButton label="Align left" variant="ghost" size="sm" icon={<Icon icon={icons.alignLeft} />} />
            <IconButton label="Align center" variant="ghost" size="sm" icon={<Icon icon={icons.alignCenter} />} />
            <Divider orientation="vertical" />
            <IconButton label="Link" variant="ghost" size="sm" icon={<Icon icon={icons.link} />} />
          </HStack>
          <HStack gap={4} vAlign="stretch">
            {[
              ["24", "Open rooms"],
              ["138", "Bids"],
              ["11", "Awarded"],
            ].map(([value, label], index) => (
              <HStack key={label} gap={4} vAlign="stretch">
                {index > 0 && <Divider orientation="vertical" />}
                <Stack gap={0}>
                  <Text type="large" weight="semibold">
                    {value}
                  </Text>
                  <Text type="supporting" color="secondary">
                    {label}
                  </Text>
                </Stack>
              </HStack>
            ))}
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Full bleed" description="isFullBleed runs past the container padding to the card edges.">
        <Card padding={4}>
          <Stack gap={3}>
            <Text weight="semibold">Card title</Text>
            <Divider isFullBleed />
            <Tile tone="neutral">Body</Tile>
            <Divider isFullBleed />
            <HStack hAlign="end">
              <Button label="Done" variant="primary" size="sm" />
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
