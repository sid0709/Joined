import type { Metadata } from "next";
import { PageHeader, Stack } from "@joined/design-system";
import { formatMoney, type AdminList, type Overview, type Payout } from "@joined/scout";
import { PAYOUT_FILTERS, PayoutFilters } from "@/components/scouting/payout-filters";
import { PayoutsTable } from "@/components/scouting/payouts-table";
import { UrlPager } from "@/components/scouting/url-pager";
import { formatCount, positiveInt } from "@/lib/format";
import { param, type SearchParams } from "@/lib/page";
import { PAYOUTS_PAGE_SIZE } from "@/lib/scouting";
import { adminGet } from "@/lib/server/api";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const requested = param(query.status);
  const status = PAYOUT_FILTERS.some((item) => item.value === requested) ? requested : "requested";
  const page = positiveInt(param(query.page), 1);
  const search = new URLSearchParams({ page: String(page), page_size: String(PAYOUTS_PAGE_SIZE) });
  if (status !== "all") search.set("status", status);
  const [list, overview] = await Promise.all([
    adminGet<AdminList<Payout>>(`/v1/admin/scout/payouts?${search.toString()}`),
    adminGet<Overview>("/v1/admin/scout/overview"),
  ]);

  return (
    <Stack gap={5}>
      <PageHeader
        title="Payouts"
        description={`${formatCount(overview.pending_payouts)} requests waiting · ${formatMoney(overview.pending_payout_amount)} to send. Send the money first, then mark it paid.`}
      />
      <PayoutFilters status={status} />
      <PayoutsTable rows={list.data} />
      <UrlPager page={list.page} pageSize={list.page_size} total={list.total} />
    </Stack>
  );
}
