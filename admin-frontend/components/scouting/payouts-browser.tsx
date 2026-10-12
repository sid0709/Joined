"use client";

import { Banner, PageHeader, Stack } from "sid-ui";
import { formatMoney, type AdminList, type Overview, type Payout } from "@joined/scout";
import { PayoutFilters } from "@/components/scouting/payout-filters";
import { PayoutsTable } from "@/components/scouting/payouts-table";
import { UrlPager } from "@/components/scouting/url-pager";
import { formatCount, positiveInt } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  PAYOUT_REQUESTED,
  PAYOUTS_PAGE_SIZE,
  SCOUT_OVERVIEW_PATH,
  payoutListStatus,
  payoutsPath,
} from "@/lib/scouting";
import { useAdminQuery, useWarmNextPage } from "@/lib/use-admin-query";
import { useListingSearch } from "@/lib/use-listing-search";

/** Payout queue. Status and page changes refetch the list, not the staff shell. */
export function PayoutsBrowser({
  initialPath,
  initialList,
  initialOverview,
}: {
  initialPath: string;
  initialList: AdminList<Payout>;
  initialOverview: Overview;
}) {
  const { searchParams, replace } = useListingSearch(ROUTES.payouts);
  const status = payoutListStatus(searchParams.get("status"));
  const page = positiveInt(searchParams.get("page"), 1);
  const path = payoutsPath(status, page);
  const listQuery = useAdminQuery<AdminList<Payout>>(path, {
    initial: initialList,
    initialPath,
  });
  const overviewQuery = useAdminQuery<Overview>(SCOUT_OVERVIEW_PATH, {
    initial: initialOverview,
    initialPath: SCOUT_OVERVIEW_PATH,
  });
  const list = listQuery.result ?? initialList;
  const overview = overviewQuery.result ?? initialOverview;
  useWarmNextPage(path, page, PAYOUTS_PAGE_SIZE, list.total);

  return (
    <Stack gap={5}>
      <PageHeader
        title="Payouts"
        description={`${formatCount(overview.pending_payouts)} requests waiting · ${formatMoney(overview.pending_payout_amount)} to send. Send the money first, then mark it paid.`}
      />
      <PayoutFilters
        status={status}
        onChange={(value) =>
          replace({ status: value === PAYOUT_REQUESTED ? null : value, page: 1 })
        }
      />
      {listQuery.error ? <Banner status="error" title={listQuery.error} /> : null}
      <PayoutsTable
        rows={list.data}
        onDecided={() => {
          listQuery.reload();
          overviewQuery.reload();
        }}
      />
      <UrlPager
        page={page}
        pageSize={list.page_size || PAYOUTS_PAGE_SIZE}
        total={list.total}
        onPageChange={(next) => replace({ page: next })}
      />
    </Stack>
  );
}
