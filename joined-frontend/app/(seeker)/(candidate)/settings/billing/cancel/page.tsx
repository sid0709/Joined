import type { Metadata } from "next";
import { CheckoutResultCard } from "@/components/billing/checkout-result";
import { PageContainer } from "@/components/page-container";

export const metadata: Metadata = { title: "Checkout canceled" };
export const dynamic = "force-dynamic";

const COPY = {
  title: "Checkout canceled",
  description: "No charge was made. You can pick a Premium plan whenever you’re ready.",
};

export default function BillingCheckoutCancelPage() {
  return (
    <PageContainer>
      <CheckoutResultCard status="info" title={COPY.title} description={COPY.description} />
    </PageContainer>
  );
}
