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
import {
  EMPLOYMENT_LABEL,
  EMPLOYMENT_OPTIONS,
  PAY_ESTIMATED_LABEL,
  SENIORITY_LABEL,
  SENIORITY_OPTIONS,
  WORKPLACE_LABEL,
  WORKPLACE_OPTIONS,
} from "@joined/job-schema";
import { CompletionBadge } from "@/components/directory/completion-badge";
import { DirectoryFilters } from "@/components/directory/directory-filters";
import { SearchJobDrawer } from "@/components/jobs/search-job-drawer";
import {
  directoryParams,
  sortValues,
  tableSort,
  yesNoOptions,
  type DirectoryFilter,
  type FilterOption,
} from "@/lib/directory";
import { formatCount, formatDate, positiveInt } from "@/lib/format";
import { listingHref } from "@/lib/listing";
import { ROUTES } from "@/lib/nav";
import {
  JOB_SORTS,
  JOB_SOURCES,
  SEARCH_JOBS_PAGE_SIZE,
  SEARCH_JOBS_PATH,
  type JobRow,
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
  const range =
    pay.period === "hour"
      ? `${pay.currency} ${pay.min}–${pay.max}/hr`
      : `${pay.currency} ${Math.round(pay.min / 1000)}k–${Math.round(pay.max / 1000)}k`;
  return pay.estimated ? `${range} · ${PAY_ESTIMATED_LABEL}` : range;
}

const SOURCE_BADGE = { direct: "green", aggregated: "neutral", scouted: "purple" } as const;

function anyOf(any: string, options: readonly FilterOption[]): FilterOption[] {
  return [{ value: "", label: any }, ...options];
}

const FILTERS: DirectoryFilter[] = [
  { param: "source", label: "Source", options: anyOf("Any source", JOB_SOURCES) },
  { param: "workplace", label: "Workplace", options: anyOf("Any workplace", WORKPLACE_OPTIONS) },
  { param: "seniority", label: "Level", options: anyOf("Any level", SENIORITY_OPTIONS) },
  {
    param: "employment",
    label: "Employment",
    options: anyOf("Any employment", EMPLOYMENT_OPTIONS),
  },
  { param: "pay", label: "Pay", options: yesNoOptions("Pay or not", "Pay listed", "No pay") },
  {
    param: "company",
    label: "Company page",
    options: yesNoOptions("Company page or not", "Has a company page", "No company page"),
  },
];

const DEFAULT_SORT = { key: JOB_SORTS.analyzed, direction: "desc" } as const;

export function SearchJobsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const jobId = searchParams.get("job");
  const params = directoryParams(searchParams, FILTERS, page, SEARCH_JOBS_PAGE_SIZE);
  const { result, loading, error, reload } = useAdminQuery<SearchJobList>(
    `${SEARCH_JOBS_PATH}?${params}`,
  );

  const go = useCallback(
    (values: Record<string, string | number | null>) =>
      router.replace(listingHref(ROUTES.jobs, new URLSearchParams(window.location.search), values)),
    [router],
  );

  const columns: TableColumn<JobRow>[] = [
    {
      key: JOB_SORTS.title,
      header: "Job",
      sortable: true,
      sortValue: (record) => record.job.title.toLowerCase(),
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
      key: "employment",
      header: "Employment",
      render: (record) => <Text color="secondary">{EMPLOYMENT_LABEL[record.job.employment]}</Text>,
    },
    {
      key: JOB_SORTS.pay,
      header: "Pay",
      align: "end",
      sortable: true,
      sortValue: (record) => record.job.pay.max,
      render: (record) => (
        <Text color="secondary" hasTabularNumbers>
          {payLabel(record)}
        </Text>
      ),
    },
    {
      key: JOB_SORTS.completion,
      header: "Completion",
      align: "end",
      sortable: true,
      sortValue: (record) => record.completion,
      render: (record) => <CompletionBadge completion={record.completion} />,
    },
    {
      key: JOB_SORTS.analyzed,
      header: "Analyzed",
      sortable: true,
      sortValue: (record) => record.analyzedAt,
      render: (record) => <Text color="secondary">{formatDate(record.analyzedAt)}</Text>,
    },
  ];

  const total = result?.total ?? 0;
  const filtered =
    FILTERS.some((filter) => searchParams.get(filter.param)) || searchParams.has("q");
  return (
    <Stack gap={5}>
      <PageHeader
        title="Jobs"
        description="The live job pool: jobs analysis published, scouted jobs, and direct posts. Open a job to fix anything analysis or a scout got wrong; saves show on Joined right away."
        action={<Button label="Analyze temp jobs" variant="secondary" href={ROUTES.jobMigration} />}
      />
      <DirectoryFilters
        current={searchParams}
        filters={FILTERS}
        search={{ label: "Search jobs", placeholder: "Title, company, place, team, skill" }}
        summary={
          result
            ? `${formatCount(total)} jobs · ${formatCount(result.pending)} temp jobs not analyzed`
            : "Loading jobs"
        }
        onChange={go}
      />
      {error ? <Banner status="error" title={error} /> : null}
      <Table
        caption="Jobs"
        columns={columns}
        rows={result?.jobs ?? []}
        rowKey={recordKey}
        loading={loading && !result}
        sort={tableSort(searchParams, DEFAULT_SORT)}
        onSortChange={(sort) => go(sortValues(sort))}
        onRowClick={(record) => go({ job: recordKey(record) })}
        empty={
          <EmptyState
            isCompact
            title={filtered ? "No jobs match" : "No jobs yet"}
            description={
              filtered
                ? "Try another search or fewer filters."
                : "Analyze temp jobs or scout jobs to fill the pool."
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
