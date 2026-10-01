import type { Metadata } from "next";
import { PageHeader, Stack } from "@joined/design-system";
import type { AdminList, ScoutSummary } from "@joined/scout";
import { ScoutFilters } from "@/components/scouting/scouts/scout-filters";
import { ScoutTable } from "@/components/scouting/scouts/scout-table";
import { UrlPager } from "@/components/scouting/url-pager";
import { positiveInt } from "@/lib/format";
import { param, type SearchParams } from "@/lib/page";
import { SCOUTS_PAGE_SIZE } from "@/lib/scouting";
import { adminGet } from "@/lib/server/api";

export const metadata: Metadata = { title: "Scouts" };

export default async function ScoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const filters = {
    verification: param(query.verification),
    level: param(query.level),
    q: param(query.q),
  };
  const page = positiveInt(param(query.page), 1);
  const search = new URLSearchParams({ page: String(page), page_size: String(SCOUTS_PAGE_SIZE) });
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
  const list = await adminGet<AdminList<ScoutSummary>>(
    `/v1/admin/scout/scouts?${search.toString()}`,
  );

  return (
    <Stack gap={5}>
      <PageHeader
        title="Scouts"
        description="Everyone who submits jobs, on the web or over the API. Open one to set a level or decide on identity."
      />
      <ScoutFilters {...filters} />
      <ScoutTable rows={list.data} />
      <UrlPager page={list.page} pageSize={list.page_size} total={list.total} />
    </Stack>
  );
}
