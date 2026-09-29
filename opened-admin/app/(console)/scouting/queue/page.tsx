import type { Metadata } from "next";
import { PageHeader, Stack } from "@openseat/design-system";
import type { AdminList, AdminSubmission } from "@openseat/scout";
import { QueueFilters } from "@/components/scouting/queue-filters";
import { QueueTable } from "@/components/scouting/queue-table";
import { UrlPager } from "@/components/scouting/url-pager";
import { positiveInt } from "@/lib/format";
import { param, type SearchParams } from "@/lib/page";
import { QUEUE_FILTERS, QUEUE_PAGE_SIZE, queueFilter } from "@/lib/scouting";
import { adminGet } from "@/lib/server/api";

export const metadata: Metadata = { title: "Review queue" };

export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const status = queueFilter(param(query.status) || null);
  const q = param(query.q);
  const channel = param(query.channel);
  const page = positiveInt(param(query.page), 1);
  const search = new URLSearchParams({ page: String(page), page_size: String(QUEUE_PAGE_SIZE) });
  if (status) search.set("status", status);
  if (q) search.set("q", q);
  if (channel) search.set("channel", channel);
  const list = await adminGet<AdminList<AdminSubmission>>(
    `/v1/admin/scout/submissions?${search.toString()}`,
  );
  const label = QUEUE_FILTERS.find((item) => item.value === status)?.label ?? "All";

  return (
    <Stack gap={5}>
      <PageHeader
        title="Review queue"
        description="Every scout submission. Open one to see its checks, the scout's record, and decide."
      />
      <QueueFilters status={status} q={q} channel={channel} />
      <QueueTable
        rows={list.data}
        caption={`${label} submissions`}
        emptyTitle={status === "needs_review" && !q ? "Queue is clear" : "No submissions match"}
        emptyDescription={
          status === "needs_review" && !q
            ? "Nothing is waiting on a moderator."
            : "Try another status or search."
        }
      />
      <UrlPager page={list.page} pageSize={list.page_size} total={list.total} />
    </Stack>
  );
}
