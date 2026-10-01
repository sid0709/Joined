import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, Stack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";

import type { ReactNode } from "react";

/**
 * Page-level composites every Joined app shares: the centered content
 * column, the page title row, a titled section card, and a row of stats.
 * Built only from Astryx parts, so they follow the theme like everything else.
 */

export const PAGE_WIDTHS = { narrow: 720, default: 1200, wide: 1360 } as const;
export type PageWidth = keyof typeof PAGE_WIDTHS;

/** Centers a page's content at a shared reading width. */
export function PageContainer({
  children,
  width = "default",
}: {
  children: ReactNode;
  width?: PageWidth;
}) {
  return (
    <Stack hAlign="center">
      <Stack gap={6} maxWidth={PAGE_WIDTHS[width]} width="100%">
        {children}
      </Stack>
    </Stack>
  );
}

/** The title row: heading, a quiet description, and the page's main action. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <HStack hAlign="between" vAlign="end" wrap="wrap" gap={3}>
      <Stack gap={1}>
        <Heading level={1}>{title}</Heading>
        {description ? (
          <Text color="secondary" display="block">
            {description}
          </Text>
        ) : null}
      </Stack>
      {action}
    </HStack>
  );
}

/** A titled card: heading, quiet description, optional action, then content. */
export function SectionCard({
  title,
  description,
  action,
  footer,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card padding={6}>
      <Stack gap={5}>
        <HStack hAlign="between" vAlign="start" gap={3} wrap="wrap">
          <Stack gap={1}>
            <Heading level={2}>{title}</Heading>
            {description ? (
              <Text type="supporting" color="secondary" display="block">
                {description}
              </Text>
            ) : null}
          </Stack>
          {action}
        </HStack>
        {children}
        {footer ? (
          <Stack gap={4}>
            <Divider />
            {footer}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}

export type Stat = {
  label: string;
  value: string;
  hint?: string;
  accessory?: ReactNode;
};

/** One headline number with its label and a quiet hint. */
export function StatCard({ label, value, hint, accessory }: Stat) {
  return (
    <Card padding={5}>
      <Stack gap={2}>
        <Text type="supporting" color="secondary" display="block">
          {label}
        </Text>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Heading level={2} type="display-3">
            {value}
          </Heading>
          {accessory}
        </HStack>
        {hint ? (
          <Text type="supporting" color="secondary" display="block">
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}

const STAT_MIN_WIDTH = 150;
const STAT_MAX_COLUMNS = 4;

/** Stats that wrap from four across to one as the page narrows. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <Grid columns={{ minWidth: STAT_MIN_WIDTH, max: STAT_MAX_COLUMNS }} gap={4}>
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </Grid>
  );
}
