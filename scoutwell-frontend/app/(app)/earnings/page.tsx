import type { Metadata } from "next";
import { EarningsWorkspace } from "@/components/earnings/earnings-workspace";

export const metadata: Metadata = { title: "Earnings" };

export default function EarningsPage() {
  return <EarningsWorkspace />;
}
