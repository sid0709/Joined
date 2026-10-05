import { Stack, PageHeader } from "sid-ui";
import { redirect } from "next/navigation";

import type { List, Submission } from "@joined/scout";
import type { Metadata } from "next";

import { CursorPager } from "@/components/cursor-pager";
import { SubmissionPipeline } from "@/components/submissions/pipeline";
import { SUBMISSION_FILTERS } from "@/components/submissions/filters";
import { StatusFilter } from "@/components/submissions/status-filter";
import { SubmissionTable } from "@/components/submissions/submission-table";
import { PAGE_LIMIT } from "@/lib/config";
import { param, type SearchParams } from "@/lib/page";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadStats } from "@/lib/scout/load";
import { scoutGet } from "@/lib/scout/server";

export const metadata: Metadata = { title: "Submissions" };

const STATUSES = new Set<string>(SUBMISSION_FILTERS.map((item) => item.value));

export default async function SubmissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const status = STATUSES.has(param(query.status)) ? param(query.status) : "";
  const cursor = param(query.cursor);
  const search = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (status) search.set("status", status);
  if (cursor) search.set("cursor", cursor);
  const [list, stats] = await Promise.all([
    scoutGet<List<Submission>>(`/submissions?${search.toString()}`),
    loadStats(),
  ]);
  if (!list || !stats) redirect(signInHref(ROUTES.submissions));

  return (
    <Stack gap={6}>
      <PageHeader
        title="Submissions"
        description="Every job you sent, what the checks found, and how it is performing."
      />
      <SubmissionPipeline metrics={stats.metrics} />
      <StatusFilter value={status} />
      <SubmissionTable
        rows={list.data}
        caption="Your submissions"
        empty={
          status
            ? { title: "Nothing here", description: "No submissions have this status." }
            : undefined
        }
      />
      <CursorPager
        basePath={ROUTES.submissions}
        params={status ? { status } : {}}
        nextCursor={list.next_cursor}
        hasCursor={Boolean(cursor)}
      />
    </Stack>
  );
}
