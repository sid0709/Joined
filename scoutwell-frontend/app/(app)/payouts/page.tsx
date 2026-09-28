import type { Metadata } from "next";
import { PayoutsWorkspace } from "@/components/payouts/payouts-workspace";

export const metadata: Metadata = { title: "Payouts" };

export default function PayoutsPage() {
  return <PayoutsWorkspace />;
}
