import type { Metadata } from "next";
import { OverviewPage } from "@/components/monitoring/overview-page";

export const metadata: Metadata = { title: "Monitoring" };

export default function MonitoringPage() {
  return <OverviewPage />;
}
