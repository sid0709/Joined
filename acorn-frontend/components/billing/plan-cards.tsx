import { Badge, Button, Card, Glyph, Grid, HStack, Heading, Stack, Text } from "sid-ui";
import { PLANS, formatPrice, yearlySaving, type BillingInterval, type PlanId } from "@/lib/billing";

const PLAN_MIN_WIDTH = 240;
const PLAN_COLUMNS = 3;

/** The three plans side by side; the current one is marked and the others offer a switch. */
export function PlanCards({ current, interval }: { current: PlanId; interval: BillingInterval }) {
  return (
    <Grid columns={{ minWidth: PLAN_MIN_WIDTH, max: PLAN_COLUMNS }} gap={4}>
      {PLANS.map((plan) => {
        const isCurrent = plan.id === current;
        const saving = yearlySaving(plan);
        return (
          <Card key={plan.id} padding={6} variant={isCurrent ? "blue" : "default"}>
            <Stack gap={4}>
              <HStack hAlign="between" vAlign="center" gap={2}>
                <Heading level={3}>{plan.name}</Heading>
                {isCurrent ? <Badge label="Current plan" variant="blue" /> : null}
              </HStack>
              <Stack gap={1}>
                <HStack gap={1} vAlign="end">
                  <Heading level={2} type="display-3">
                    {formatPrice(plan.price[interval])}
                  </Heading>
                  <Text color="secondary">/ month</Text>
                </HStack>
                <Text type="supporting" color="secondary">
                  {interval === "yearly" && saving > 0
                    ? `Billed yearly · save ${formatPrice(saving)} a year`
                    : plan.tagline}
                </Text>
              </Stack>
              <Stack gap={2}>
                {plan.features.map((feature) => (
                  <HStack key={feature} gap={2} vAlign="center">
                    <Glyph name="check" />
                    <Text>{feature}</Text>
                  </HStack>
                ))}
              </Stack>
              <Button
                label={isCurrent ? "Your plan" : `Switch to ${plan.name}`}
                variant={isCurrent ? "secondary" : "primary"}
                isDisabled
              />
            </Stack>
          </Card>
        );
      })}
    </Grid>
  );
}
