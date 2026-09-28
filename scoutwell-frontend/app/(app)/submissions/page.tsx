import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Stack, PageHeader } from "@openseat/design-system";
import type { List, Submission } from "@openseat/scout";
import { CursorPager } from "@/components/cursor-pager";
import { StatusFilter, SUBMISSION_FILTERS } from "@/components/submissions/status-filter";
import { SubmissionTable } from "@/components/submissions/submission-table";
import { PAGE_LIMIT } from "@/lib/config";
import { param, type SearchParams } from "@/lib/page";
import { ROUTES, signInHref } from "@/lib/routes";
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
  const list = await scoutGet<List<Submission>>(`/submissions?${search.toString()}`);
  if (!list) redirect(signInHref(ROUTES.submissions));

  return (
    <Stack gap={6}>
      <PageHeader
        title="Submissions"
        description="Every job you sent, what the checks found, and how it is performing."
        action={<Button label="Submit a job" variant="primary" href={ROUTES.submit} />}
      />
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
