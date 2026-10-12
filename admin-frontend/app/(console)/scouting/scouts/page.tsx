import type { Metadata } from "next";
import type { AdminList, ScoutSummary } from "@joined/scout";
import { ScoutsBrowser } from "@/components/scouting/scouts/scouts-browser";
import { positiveInt } from "@/lib/format";
import { param, type SearchParams } from "@/lib/page";
import { scoutsPath } from "@/lib/scouting";
import { adminGet } from "@/lib/server/api";

export const metadata: Metadata = { title: "Scouts" };

export default async function ScoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const filters = {
    verification: param(query.verification),
    level: param(query.level),
    q: param(query.q),
    page: positiveInt(param(query.page), 1),
  };
  const path = scoutsPath(filters);
  const list = await adminGet<AdminList<ScoutSummary>>(path);
  return <ScoutsBrowser initialPath={path} initialList={list} />;
}
