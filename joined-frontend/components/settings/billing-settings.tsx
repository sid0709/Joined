"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  HStack,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
  useToast,
} from "sid-ui";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import {
  BILLING_MESSAGES,
  currentBillingPlan,
  formatRenewalDate,
  hasStripeCustomer,
  parseBillingPlan,
  planAmountCents,
  planIntervalLabel,
  planLabel,
  PRICING_PAGE,
  subscriptionStatusMeta,
  type BillingPlan,
  type BillingSubscription,
  type PremiumPrices,
} from "@/lib/billing";
import { startPortal } from "@/lib/me/billing";
import { formatCents } from "@/lib/money";
import { ROUTES } from "@/lib/routes";

function planDisplay(subscription: BillingSubscription | null) {
  if (!subscription?.premium) return BILLING_MESSAGES.freePlan;
  const plan = currentBillingPlan(subscription) ?? parseBillingPlan(subscription.plan);
  return plan ? planLabel(plan) : BILLING_MESSAGES.currentPlan;
}

function planPriceLabel(subscription: BillingSubscription | null, prices: PremiumPrices) {
  if (!subscription?.premium) return BILLING_MESSAGES.freePlan;
  const plan: BillingPlan | null =
    currentBillingPlan(subscription) ?? parseBillingPlan(subscription.plan);
  if (!plan) return BILLING_MESSAGES.currentPlan;
  return `${formatCents(planAmountCents(plan, prices), prices.currency)} / ${planIntervalLabel(plan)}`;
}

export function BillingSettings({
  subscription,
  prices,
  checkoutEnabled,
}: {
  subscription: BillingSubscription | null;
  prices: PremiumPrices;
  checkoutEnabled: boolean;
}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const status = subscriptionStatusMeta(subscription?.status);
  const canManage = hasStripeCustomer(subscription);

  const openPortal = async () => {
    setPending(true);
    try {
      const session = await startPortal(window.location.origin);
      if (!session.url) throw new Error(BILLING_MESSAGES.missingPortalUrl);
      window.location.assign(session.url);
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : BILLING_MESSAGES.portalFailed,
        type: "error",
      });
      setPending(false);
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
      <SettingsGroup
        title="Plan"
        description="Joined Premium is billed through Stripe in test mode."
        action={
          canManage ? (
            <Button
              label={BILLING_MESSAGES.manageBilling}
              variant="secondary"
              size="sm"
              isLoading={pending}
              isDisabled={pending}
              onClick={() => void openPortal()}
            />
          ) : checkoutEnabled ? (
            <Button
              label={BILLING_MESSAGES.seePlans}
              variant="secondary"
              size="sm"
              href={ROUTES.pricing}
            />
          ) : null
        }
      >
        <SettingsRow label="Current plan" layout="inline">
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text weight="medium">{planDisplay(subscription)}</Text>
            {subscription?.premium ? (
              <Badge label="Premium" variant="success" />
            ) : (
              <Badge label={BILLING_MESSAGES.freePlan} variant="neutral" />
            )}
          </HStack>
        </SettingsRow>
        <SettingsRow label="Price" layout="inline">
          <Text weight="medium">{planPriceLabel(subscription, prices)}</Text>
        </SettingsRow>
        <SettingsRow label="Status" layout="inline">
          <Badge label={status.label} variant={status.badge} />
        </SettingsRow>
        <SettingsRow
          label="Renews"
          description="The end of the current billing period from Stripe."
          layout="inline"
        >
          <Text weight="medium">{formatRenewalDate(subscription?.current_period_end)}</Text>
        </SettingsRow>
      </SettingsGroup>
      <MetadataList>
        <MetadataListItem label={PRICING_PAGE.label}>
          {checkoutEnabled
            ? "Choose monthly or yearly on the pricing page, then finish in Stripe Checkout."
            : BILLING_MESSAGES.checkoutDisabledDescription}
        </MetadataListItem>
      </MetadataList>
    </Stack>
  );
}
