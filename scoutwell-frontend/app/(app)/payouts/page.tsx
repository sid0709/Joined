import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { List, Payout } from "@joined/scout";
import { PayoutsView } from "@/components/payouts/payouts-view";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadMeta, loadStats } from "@/lib/scout/load";
import { scoutGet } from "@/lib/scout/server";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const [stats, meta, payouts] = await Promise.all([
    loadStats(),
    loadMeta(),
    scoutGet<List<Payout>>("/payouts?limit=50"),
  ]);
  if (!stats || !payouts) redirect(signInHref(ROUTES.payouts));
  return <PayoutsView stats={stats} minPayout={meta.rewards.min_payout} payouts={payouts.data} />;
}
