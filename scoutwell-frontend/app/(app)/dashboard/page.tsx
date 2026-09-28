import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { List, ScoutNotification, Submission } from "@openseat/scout";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { RECENT_LIMIT } from "@/lib/config";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadStats } from "@/lib/scout/load";
import { scoutGet } from "@/lib/scout/server";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const [stats, submissions, notifications] = await Promise.all([
    loadStats(),
    scoutGet<List<Submission>>(`/submissions?limit=${RECENT_LIMIT}`),
    scoutGet<List<ScoutNotification>>(`/notifications?limit=${RECENT_LIMIT}`),
  ]);
  if (!stats || !submissions || !notifications) redirect(signInHref(ROUTES.dashboard));
  return <DashboardView stats={stats} recent={submissions.data} activity={notifications.data} />;
}
