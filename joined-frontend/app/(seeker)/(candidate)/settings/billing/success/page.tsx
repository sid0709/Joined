import type { Metadata } from "next";
import { CheckoutResultCard } from "@/components/billing/checkout-result";
import { PageContainer } from "@/components/page-container";

export const metadata: Metadata = { title: "Premium checkout" };
export const dynamic = "force-dynamic";

const COPY = {
  title: "You’re Premium",
  description: "Checkout finished. Manage or cancel the plan from billing whenever you want.",
};

export default function BillingCheckoutSuccessPage() {
  return (
    <PageContainer>
      <CheckoutResultCard status="success" title={COPY.title} description={COPY.description} />
    </PageContainer>
  );
}
