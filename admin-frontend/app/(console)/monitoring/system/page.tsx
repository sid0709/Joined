import type { Metadata } from "next";
import { SystemMonitor } from "@/components/monitoring/system-monitor";

export const metadata: Metadata = { title: "System" };

export default function SystemMonitoringPage() {
  return <SystemMonitor />;
}
