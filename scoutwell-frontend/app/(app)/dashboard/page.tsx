import type { Metadata } from "next";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return <DashboardWorkspace />;
}
