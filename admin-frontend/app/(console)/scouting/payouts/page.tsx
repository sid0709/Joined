import type { Metadata } from "next";
import type { AdminList, Overview, Payout } from "@joined/scout";
import { PayoutsBrowser } from "@/components/scouting/payouts-browser";
import { positiveInt } from "@/lib/format";
import { param, type SearchParams } from "@/lib/page";
import { SCOUT_OVERVIEW_PATH, payoutListStatus, payoutsPath } from "@/lib/scouting";
import { adminGet } from "@/lib/server/api";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const status = payoutListStatus(param(query.status));
  const page = positiveInt(param(query.page), 1);
  const path = payoutsPath(status, page);
  const [list, overview] = await Promise.all([
    adminGet<AdminList<Payout>>(path),
    adminGet<Overview>(SCOUT_OVERVIEW_PATH),
  ]);
  return <PayoutsBrowser initialPath={path} initialList={list} initialOverview={overview} />;
}
