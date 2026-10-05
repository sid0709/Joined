import type { Metadata } from "next";
import { BillingPanel } from "@/components/billing/billing-panel";
import { loadActivity } from "@/lib/workspace/activity";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return <BillingPanel activity={loadActivity()} />;
}
