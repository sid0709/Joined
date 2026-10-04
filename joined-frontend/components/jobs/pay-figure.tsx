import { Badge, HStack, Stack, Text } from "@joined/design-system";
import { PAY_ESTIMATED_LABEL } from "@joined/job-schema";
import { formatPay, paySourceLabel, type Pay } from "@/lib/jobs";

/** The salary range, and whether the posting stated it or it is a published average. */
export function PayFigure({ pay, detailed = false }: { pay: Pay; detailed?: boolean }) {
  const source = paySourceLabel(pay);
  return (
    <Stack gap={1}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Text weight="medium" hasTabularNumbers>
          {formatPay(pay)}
        </Text>
        {source ? <Badge label={source} variant={pay.estimated ? "warning" : "neutral"} /> : null}
      </HStack>
      {detailed && source === PAY_ESTIMATED_LABEL ? (
        <Text type="supporting" color="secondary">
          Estimated from the company’s published average for this role. The posting did not state
          pay.
        </Text>
      ) : null}
    </Stack>
  );
}
