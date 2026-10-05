"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  Grid,
  Heading,
  HStack,
  List,
  ListItem,
  Stack,
  Text,
  useToast,
} from "@joined/design-system";
import {
  BILLING_MESSAGES,
  BILLING_PLANS,
  currentBillingPlan,
  planAmountCents,
  planIntervalLabel,
  planLabel,
  PREMIUM_FEATURES,
  yearlySavingsCents,
  type BillingPlan,
  type BillingSubscription,
  type PremiumPrices,
} from "@/lib/billing";
import { startCheckout } from "@/lib/me/billing";
import { formatCents } from "@/lib/money";
import { ROUTES, settingsSectionHref, signInHref } from "@/lib/routes";

const CARD_MIN_WIDTH = 280;
const GRID_MAX_COLUMNS = 2;

export function PricingPlans({
  prices,
  subscription,
  signedIn,
  checkoutEnabled,
}: {
  prices: PremiumPrices;
  subscription: BillingSubscription | null;
  signedIn: boolean;
  checkoutEnabled: boolean;
}) {
  const toast = useToast();
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);
  const currentPlan = currentBillingPlan(subscription);
  const isPremium = Boolean(subscription?.premium);
  const savingsCents = yearlySavingsCents(prices.monthlyCents, prices.yearlyCents);

  const upgrade = async (plan: BillingPlan) => {
    if (!signedIn) {
      window.location.assign(signInHref(ROUTES.pricing));
      return;
    }
    setPendingPlan(plan);
    try {
      const session = await startCheckout(plan, window.location.origin);
      if (!session.url) throw new Error(BILLING_MESSAGES.missingCheckoutUrl);
      window.location.assign(session.url);
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : BILLING_MESSAGES.checkoutFailed,
        type: "error",
      });
      setPendingPlan(null);
    }
  };

  return (
    <Stack gap={6}>
      {checkoutEnabled ? null : (
        <Banner
          status="warning"
          title={BILLING_MESSAGES.checkoutDisabledTitle}
          description={BILLING_MESSAGES.checkoutDisabledDescription}
        />
      )}
      <Grid columns={{ minWidth: CARD_MIN_WIDTH, max: GRID_MAX_COLUMNS }} gap={4}>
        {BILLING_PLANS.map((plan) => {
          const isCurrent = currentPlan === plan;
          const amount = formatCents(planAmountCents(plan, prices), prices.currency);
          const interval = planIntervalLabel(plan);
          return (
            <Card key={plan} padding={6}>
              <Stack gap={5}>
                <HStack hAlign="between" vAlign="start" gap={3} wrap="wrap">
                  <Stack gap={1}>
                    <Heading level={2}>{planLabel(plan)}</Heading>
                    <Text type="supporting" color="secondary" display="block">
                      {amount} / {interval}
                    </Text>
                  </Stack>
                  {isCurrent ? (
                    <Badge label={BILLING_MESSAGES.currentPlan} variant="success" />
                  ) : plan === "yearly" && savingsCents > 0 ? (
                    <Badge
                      label={`Save ${formatCents(savingsCents, prices.currency)}`}
                      variant="info"
                    />
                  ) : null}
                </HStack>
                <List listStyle="disc">
                  {PREMIUM_FEATURES.map((item) => (
                    <ListItem key={item} label={item} />
                  ))}
                </List>
                {isCurrent || isPremium ? (
                  <Button
                    label={BILLING_MESSAGES.manageBilling}
                    variant="secondary"
                    href={settingsSectionHref("billing")}
                  />
                ) : checkoutEnabled ? (
                  <Button
                    label={signedIn ? BILLING_MESSAGES.upgrade : BILLING_MESSAGES.signInToUpgrade}
                    variant="primary"
                    isLoading={pendingPlan === plan}
                    isDisabled={pendingPlan != null}
                    onClick={() => void upgrade(plan)}
                  />
                ) : (
                  <Button label={BILLING_MESSAGES.upgrade} variant="primary" isDisabled />
                )}
              </Stack>
            </Card>
          );
        })}
      </Grid>
    </Stack>
  );
}
