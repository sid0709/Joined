import { HStack, Heading, ProgressBar, Stack, Text } from "@openseat/design-system";
import type { BillingAccount } from "@/lib/company";
import { formatCents } from "@/lib/money";

/** Remaining purchase balance, and how much interviews have used. */
export function SpendSummary({ billing }: { billing: BillingAccount }) {
  const purchased = billing.purchasedCents;
  const remaining = billing.balanceCents;

  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <HStack hAlign="between" vAlign="end">
          <Stack gap={0.5}>
            <Text type="supporting" color="secondary">
              Balance left
            </Text>
            <Heading level={3} type="display-3">
              {formatCents(remaining, billing.currency)}
            </Heading>
          </Stack>
          <Text type="supporting" color="secondary">
            of {formatCents(purchased, billing.currency)} purchased
          </Text>
        </HStack>
        <ProgressBar
          label="Balance remaining"
          isLabelHidden
          value={remaining}
          max={Math.max(purchased, 1)}
          variant={remaining === 0 ? "warning" : "accent"}
        />
      </Stack>
      <HStack hAlign="between">
        <Text type="supporting" color="secondary">
          Used on interviews
        </Text>
        <Text type="supporting" weight="semibold" hasTabularNumbers>
          {formatCents(billing.spentCents, billing.currency)}
        </Text>
      </HStack>
    </Stack>
  );
}
