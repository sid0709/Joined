import { HStack, Heading, ProgressBar, Stack, Text } from "@openseat/design-system";
import { BILLING } from "@/lib/company";
import { formatCents } from "@/lib/money";

const WARN_SHARE = 0.8;

/** Spend against the monthly cap, and free interviews left. Shared by Overview and Billing. */
export function SpendSummary() {
  const nearCap = BILLING.spendCents >= BILLING.capCents * WARN_SHARE;
  const freeUsed = BILLING.freeInterviewsTotal - BILLING.freeInterviewsRemaining;

  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <HStack hAlign="between" vAlign="end">
          <Stack gap={0.5}>
            <Text type="supporting" color="secondary">
              Spent this month
            </Text>
            <Heading level={3} type="display-3">
              {formatCents(BILLING.spendCents, BILLING.currency)}
            </Heading>
          </Stack>
          <Text type="supporting" color="secondary">
            of {formatCents(BILLING.capCents, BILLING.currency)} cap
          </Text>
        </HStack>
        <ProgressBar
          label="Spend against cap"
          isLabelHidden
          value={BILLING.spendCents}
          max={BILLING.capCents}
          variant={nearCap ? "warning" : "accent"}
        />
      </Stack>
      <Stack gap={2}>
        <HStack hAlign="between">
          <Text type="supporting" color="secondary">
            Free interviews
          </Text>
          <Text type="supporting" weight="semibold" hasTabularNumbers>
            {BILLING.freeInterviewsRemaining} of {BILLING.freeInterviewsTotal} left
          </Text>
        </HStack>
        <ProgressBar
          label="Free interviews used"
          isLabelHidden
          value={freeUsed}
          max={BILLING.freeInterviewsTotal}
          variant="success"
        />
      </Stack>
    </Stack>
  );
}
