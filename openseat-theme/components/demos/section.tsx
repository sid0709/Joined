"use client";

import {
  Button,
  Card,
  GridColumn,
  GridSystem,
  Heading,
  HStack,
  ResponsiveFrame,
  Section,
  Stack,
  Text,
  Tile,
  type SectionVariant,
} from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const VARIANTS: SectionVariant[] = ["section", "muted", "transparent"];

export default function SectionDemo() {
  return (
    <Examples>
      <Preview label="Variants" description="section is a raised surface; muted recedes; transparent only adds padding and structure.">
        <Stack gap={3}>
          {VARIANTS.map((variant) => (
            <Section key={variant} variant={variant} padding={4}>
              <Stack gap={1}>
                <Heading level={4}>{variant}</Heading>
                <Text color="secondary">A titled block of related content.</Text>
              </Stack>
            </Section>
          ))}
        </Stack>
      </Preview>

      <Preview label="Padding" description="Uniform, inline-only, or block-only padding on the spacing scale.">
        <Stack gap={3}>
          <Section variant="muted" padding={2}>
            <Tile>padding 2</Tile>
          </Section>
          <Section variant="muted" padding={6}>
            <Tile>padding 6</Tile>
          </Section>
          <Section variant="muted" paddingInline={8} paddingBlock={2}>
            <Tile>paddingInline 8 · paddingBlock 2</Tile>
          </Section>
        </Stack>
      </Preview>

      <Preview label="Dividers" description="Hairlines on any edge separate stacked sections without extra chrome.">
        <Card padding={0}>
          <Section dividers={["bottom"]} padding={4}>
            <Text weight="semibold">Room details</Text>
          </Section>
          <Section dividers={["bottom"]} padding={4}>
            <Text color="secondary">Fixed price · $2,400 · two weeks</Text>
          </Section>
          <Section padding={4}>
            <HStack gap={2} hAlign="end">
              <Button label="Edit" />
              <Button label="Publish" variant="primary" />
            </HStack>
          </Section>
        </Card>
      </Preview>

      <Preview label="Constrained width" description="maxWidth keeps long reading content at a comfortable measure.">
        <Section variant="muted" padding={5} maxWidth={560}>
          <Stack gap={2}>
            <Heading level={3}>How sealed rooms work</Heading>
            <Text color="secondary">
              Bids stay private until you open them. Invite the people you trust, compare offers side by side, and award the seat when
              you are ready.
            </Text>
          </Stack>
        </Section>
      </Preview>

      <Preview label="Responsive settings page" description="Sections stack on phones; from md, the title sits in a left column beside its fields.">
        <ResponsiveFrame defaultPreset="Laptop">
          <Stack gap={0}>
            {[
              { title: "Profile", hint: "How bidders see you." },
              { title: "Notifications", hint: "When we reach out." },
              { title: "Billing", hint: "Plans and invoices." },
            ].map((group, index, all) => (
              <Section key={group.title} dividers={index < all.length - 1 ? ["bottom"] : []} paddingBlock={4}>
                <GridSystem gap={4}>
                  <GridColumn span={12} md={4}>
                    <Stack gap={1}>
                      <Text weight="semibold">{group.title}</Text>
                      <Text type="supporting" color="secondary">
                        {group.hint}
                      </Text>
                    </Stack>
                  </GridColumn>
                  <GridColumn span={12} md={8}>
                    <Tile tone="neutral" height={72}>
                      Fields
                    </Tile>
                  </GridColumn>
                </GridSystem>
              </Section>
            ))}
          </Stack>
        </ResponsiveFrame>
      </Preview>
    </Examples>
  );
}
