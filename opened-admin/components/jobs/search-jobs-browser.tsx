"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  HStack,
  PageHeader,
  Pagination,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@joined/design-system";
import { SENIORITY_LABEL, WORKPLACE_LABEL } from "@joined/job-schema";
import { SearchJobDrawer } from "@/components/jobs/search-job-drawer";
import { SearchBox } from "@/components/search-box";
import { formatCount, positiveInt } from "@/lib/format";
import { listingHref } from "@/lib/listing";
import { ROUTES } from "@/lib/nav";
import {
  SEARCH_JOBS_PAGE_SIZE,
  SEARCH_JOBS_PATH,
  type SearchJobList,
  type SearchRecord,
} from "@/lib/search-job";
import { useAdminQuery } from "@/lib/use-admin-query";

/** Scouted jobs have no temp job; their public id opens them instead. */
export function recordKey(record: SearchRecord) {
  return record.tempJobId || record.job.id;
}

function payLabel(record: SearchRecord) {
  const pay = record.job.pay;
  if (pay.min === 0 && pay.max === 0) return "Not listed";
  if (pay.period === "hour") return `${pay.currency} ${pay.min}–${pay.max}/hr`;
  return `${pay.currency} ${Math.round(pay.min / 1000)}k–${Math.round(pay.max / 1000)}k`;
}

const SOURCE_BADGE = { direct: "green", aggregated: "neutral", scouted: "purple" } as const;

export function SearchJobsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const query = searchParams.get("q") ?? "";
  const jobId = searchParams.get("job");
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(SEARCH_JOBS_PAGE_SIZE),
    q: query,
  });
  const { result, loading, error, reload } = useAdminQuery<SearchJobList>(
    `${SEARCH_JOBS_PATH}?${params}`,
  );

  const go = useCallback(
    (values: Record<string, string | number | null>) =>
      router.replace(listingHref(ROUTES.jobs, new URLSearchParams(window.location.search), values)),
    [router],
  );

  const columns: TableColumn<SearchRecord>[] = [
    {
      key: "title",
      header: "Job",
      render: (record) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{record.job.title}</Text>
          <Text type="supporting" color="secondary">
            {record.job.company} · {record.job.location}
          </Text>
          {record.job.skills.length ? (
            <Text type="supporting" color="secondary">
              {record.job.skills.slice(0, 4).join(" · ")}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (record) => (
        <Badge label={record.job.source} variant={SOURCE_BADGE[record.job.source] ?? "neutral"} />
      ),
    },
    {
      key: "workplace",
      header: "Workplace",
      render: (record) => <Text color="secondary">{WORKPLACE_LABEL[record.job.workplace]}</Text>,
    },
    {
      key: "seniority",
      header: "Level",
      render: (record) => <Text color="secondary">{SENIORITY_LABEL[record.job.seniority]}</Text>,
    },
    {
      key: "pay",
      header: "Pay",
      align: "end",
      render: (record) => (
        <Text color="secondary" hasTabularNumbers>
          {payLabel(record)}
        </Text>
      ),
    },
  ];

  const total = result?.total ?? 0;
  return (
    <Stack gap={5}>
      <PageHeader
        title="Jobs"
        description="The live job pool. Open a job to fix anything analysis or a scout got wrong; saves show on Opened right away."
        action={<Button label="Analyze temp jobs" variant="secondary" href={ROUTES.tempJobs} />}
      />
      <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
        <HStack width={360}>
          <SearchBox
            key={query}
            value={query}
            label="Search jobs"
            placeholder="Title or company"
            onSearch={(value) => go({ q: value, page: 1 })}
          />
        </HStack>
        <Text type="supporting" color="secondary">
          {result
            ? `${formatCount(total)} jobs · ${formatCount(result.pending)} temp jobs not analyzed`
            : "Loading jobs"}
        </Text>
      </HStack>
      {error ? <Banner status="error" title={error} /> : null}
      <Table
        caption="Jobs"
        columns={columns}
        rows={result?.jobs ?? []}
        rowKey={recordKey}
        loading={loading && !result}
        onRowClick={(record) => go({ job: recordKey(record) })}
        empty={
          <EmptyState
            isCompact
            title={query ? `No jobs match "${query}"` : "No jobs yet"}
            description={
              query ? "Try another search." : "Analyze temp jobs or scout jobs to fill the pool."
            }
          />
        }
      />
      {total > SEARCH_JOBS_PAGE_SIZE ? (
        <HStack hAlign="end">
          <Pagination
            page={page}
            totalItems={total}
            pageSize={SEARCH_JOBS_PAGE_SIZE}
            onChange={(next) => go({ page: next })}
            size="sm"
          />
        </HStack>
      ) : null}
      {jobId ? (
        <SearchJobDrawer jobId={jobId} onClose={() => go({ job: null })} onSaved={reload} />
      ) : null}
    </Stack>
  );
}
