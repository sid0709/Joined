import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LevelView } from "@/components/level/level-view";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadMeta, loadStats } from "@/lib/scout/load";

export const metadata: Metadata = { title: "Level & limits" };

export default async function LevelPage() {
  const [stats, meta] = await Promise.all([loadStats(), loadMeta()]);
  if (!stats) redirect(signInHref(ROUTES.level));
  return <LevelView stats={stats} levels={meta.levels} />;
}
