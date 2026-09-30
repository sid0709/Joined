import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { HStack, Stack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";

import type { ReactNode } from "react";

export type KpiDelta = {
  /** Already formatted, e.g. "+12%". */
  value: string;
  /** Colours the change: up is good, down is bad, flat is quiet. */
  direction: "up" | "down" | "flat";
};

const DELTA_VARIANT = { up: "success", down: "error", flat: "neutral" } as const;

/**
 * A dashboard number with room for what makes it readable at a glance: a quiet label with an
 * optional action, a change since last period, a hint, and one visual (Sparkline, SegmentBar).
 */
export function KpiWidget({
  label,
  value,
  delta,
  hint,
  action,
  children,
}: {
  label: string;
  value: string;
  delta?: KpiDelta;
  hint?: string;
  action?: ReactNode;
  /** The visual under the number. */
  children?: ReactNode;
}) {
  return (
    <Card padding={5}>
      <Stack gap={3}>
        <HStack hAlign="between" vAlign="center" gap={2}>
          <Text type="supporting" color="secondary" display="block">
            {label}
          </Text>
          {action}
        </HStack>
        <HStack gap={2} vAlign="end" wrap="wrap">
          <Heading level={2} type="display-3">
            {value}
          </Heading>
          {delta ? <Badge label={delta.value} variant={DELTA_VARIANT[delta.direction]} /> : null}
        </HStack>
        {children}
        {hint ? (
          <Text type="supporting" color="secondary" display="block">
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
