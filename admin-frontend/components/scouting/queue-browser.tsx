"use client";

import { Banner, PageHeader, Stack } from "sid-ui";
import type { AdminList, AdminSubmission } from "@joined/scout";
import { QueueFilters } from "@/components/scouting/queue-filters";
import { QueueTable } from "@/components/scouting/queue-table";
import { UrlPager } from "@/components/scouting/url-pager";
import { positiveInt } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  QUEUE_FILTERS,
  QUEUE_PAGE_SIZE,
  queueFilter,
  queueQuery,
  submissionsPath,
  type QueueFilter,
} from "@/lib/scouting";
import { useAdminQuery, useWarmNextPage } from "@/lib/use-admin-query";
import { useListingSearch } from "@/lib/use-listing-search";

/** Review queue. Page changes fetch the list in place and leave the shell alone. */
export function QueueBrowser({
  initialPath,
  initialList,
}: {
  initialPath: string;
  initialList: AdminList<AdminSubmission>;
}) {
  const { searchParams, commit } = useListingSearch(ROUTES.queue);
  const status = queueFilter(searchParams.get("status"));
  const q = searchParams.get("q") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const page = positiveInt(searchParams.get("page"), 1);
  const filters = { status, q, channel, page };
  const path = submissionsPath(filters);
  const { result, error } = useAdminQuery<AdminList<AdminSubmission>>(path, {
    initial: initialList,
    initialPath,
  });
  const list = result ?? initialList;
  useWarmNextPage(path, page, QUEUE_PAGE_SIZE, list.total);
  const label = QUEUE_FILTERS.find((item) => item.value === status)?.label ?? "All";
  const show = (next: Partial<{ status: QueueFilter; q: string; channel: string; page: number }>) =>
    commit(`${ROUTES.queue}${queueQuery({ ...filters, ...next })}`);

  return (
    <Stack gap={5}>
      <PageHeader
        title="Review queue"
        description="Every scout submission. Open one to see its checks, the scout's record, and decide."
      />
      <QueueFilters
        status={status}
        q={q}
        channel={channel}
        onChange={(next) => show({ ...next, page: 1 })}
      />
      {error ? <Banner status="error" title={error} /> : null}
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
      <UrlPager
        page={page}
        pageSize={list.page_size || QUEUE_PAGE_SIZE}
        total={list.total}
        onPageChange={(next) => show({ page: next })}
      />
    </Stack>
  );
}
