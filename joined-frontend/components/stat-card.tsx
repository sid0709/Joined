import type { ReactNode } from "react";
import { Card, Grid, HStack, Heading, Stack, Text } from "@joined/design-system";

export type Stat = {
  label: string;
  value: string;
  hint?: string;
  /** A badge, dot, or trend beside the value. */
  accessory?: ReactNode;
};

const STAT_MIN_WIDTH = 150;
const STAT_MAX_COLUMNS = 4;

/** One headline number with a quiet label and hint. */
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

/** A responsive row of stat cards: four across on desktop, stacked on phones. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <Grid columns={{ minWidth: STAT_MIN_WIDTH, max: STAT_MAX_COLUMNS }} gap={4}>
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </Grid>
  );
}
