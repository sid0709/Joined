"use client";

import { Banner, PageHeader, Stack } from "sid-ui";
import type { AdminList, ScoutSummary } from "@joined/scout";
import { ScoutFilters, type ScoutFilterState } from "@/components/scouting/scouts/scout-filters";
import { ScoutTable } from "@/components/scouting/scouts/scout-table";
import { UrlPager } from "@/components/scouting/url-pager";
import { positiveInt } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import { SCOUTS_PAGE_SIZE, scoutsPath } from "@/lib/scouting";
import { useAdminQuery, useWarmNextPage } from "@/lib/use-admin-query";
import { useListingSearch } from "@/lib/use-listing-search";

/** Scout directory. Filters and pages update the list without a route change. */
export function ScoutsBrowser({
  initialPath,
  initialList,
}: {
  initialPath: string;
  initialList: AdminList<ScoutSummary>;
}) {
  const { searchParams, replace } = useListingSearch(ROUTES.scouts);
  const filters: ScoutFilterState = {
    verification: searchParams.get("verification") ?? "",
    level: searchParams.get("level") ?? "",
    q: searchParams.get("q") ?? "",
  };
  const page = positiveInt(searchParams.get("page"), 1);
  const path = scoutsPath({ ...filters, page });
  const { result, error } = useAdminQuery<AdminList<ScoutSummary>>(path, {
    initial: initialList,
    initialPath,
  });
  const list = result ?? initialList;
  useWarmNextPage(path, page, SCOUTS_PAGE_SIZE, list.total);

  return (
    <Stack gap={5}>
      <PageHeader
        title="Scouts"
        description="Everyone who submits jobs, on the web or over the API. Open one to set a level or decide on identity."
      />
      <ScoutFilters
        current={filters}
        onChange={(next) => replace({ ...filters, ...next, page: 1 })}
      />
      {error ? <Banner status="error" title={error} /> : null}
      <ScoutTable rows={list.data} />
      <UrlPager
        page={page}
        pageSize={list.page_size || SCOUTS_PAGE_SIZE}
        total={list.total}
        onPageChange={(next) => replace({ page: next })}
      />
    </Stack>
  );
}
