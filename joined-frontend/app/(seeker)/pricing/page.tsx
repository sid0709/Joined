import type { Metadata } from "next";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { PRICING_PAGE } from "@/lib/billing";
import { isBillingCheckoutEnabled, premiumPrices } from "@/lib/config";
import { loadSubscription } from "@/lib/me/load";

export const metadata: Metadata = {
  title: PRICING_PAGE.label,
  description: PRICING_PAGE.description,
};
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await loadSession();
  const subscription = session ? await loadSubscription() : null;
  return (
    <PageContainer>
      <PageHeader title={PRICING_PAGE.label} description={PRICING_PAGE.description} />
      <PricingPlans
        prices={premiumPrices()}
        subscription={subscription}
        signedIn={Boolean(session)}
        checkoutEnabled={isBillingCheckoutEnabled()}
      />
    </PageContainer>
  );
}
