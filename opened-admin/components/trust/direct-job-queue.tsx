"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  PageHeader,
  Stack,
  Tab,
  TabList,
  Table,
  Text,
  type TableColumn,
} from "@openseat/design-system";
import { UrlPager } from "@/components/scouting/url-pager";
import { TrustState } from "@/components/trust/trust-state";
import { ageLabel, positiveInt } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  DIRECT_JOB_PENDING,
  DIRECT_JOB_STATUSES,
  TRUST_PAGE_SIZE,
  directJobListQuery,
  directJobStatus,
  directJobsPath,
  readDirectJobList,
  trustLoadError,
  type DirectJob,
} from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

/** Direct jobs sitting in pending_review, separate from the jobs CMS. */
export function DirectJobQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = directJobStatus(searchParams.get("status"));
  const page = positiveInt(searchParams.get("page"), 1);
  const { result, loading, error, errorStatus } = useAdminQuery<unknown>(
    directJobsPath(status, page),
  );
  const list = result ? readDirectJobList(result) : null;
  const message =
    list && !list.recognized
      ? "The API responded, but not with a direct-job list."
      : error
        ? trustLoadError(errorStatus, error)
        : null;

  const go = useCallback(
    (next: string) => router.push(`${ROUTES.directReview}${directJobListQuery(next, 1)}`),
    [router],
  );

  const columns: TableColumn<DirectJob>[] = [
    {
      key: "title",
      header: "Job",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.title}</Text>
          <Text type="supporting" color="secondary">
            {row.status || "—"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (row) => <Text color="secondary">{row.companyName || row.companyId || "—"}</Text>,
    },
    {
      key: "source",
      header: "Source",
      render: (row) => <Badge label={row.source || "direct"} variant="green" />,
    },
    {
      key: "age",
      header: "Posted",
      render: (row) => <Text color="secondary">{ageLabel(row.postedAt)}</Text>,
    },
  ];

  const showTable = Boolean(list?.recognized && list.rows.length);
  return (
    <Stack gap={5}>
      <PageHeader
        title="Direct review"
        description="Company-posted jobs with source direct and status pending review. Approving makes a job active."
      />
      <TabList
        value={status || "all"}
        onChange={(value) => go(value === "all" ? "" : value)}
        hasDivider
        overflow="scroll"
      >
        {DIRECT_JOB_STATUSES.map((item) => (
          <Tab key={item.value || "all"} value={item.value || "all"} label={item.label} />
        ))}
      </TabList>
      {showTable ? (
        <Table
          caption="Direct jobs pending review"
          columns={columns}
          rows={list?.rows ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(ROUTES.directJob(row.id))}
        />
      ) : (
        <TrustState
          loading={loading && !result}
          error={loading ? null : message}
          empty={!loading && !message}
          emptyTitle={
            status === DIRECT_JOB_PENDING ? "No direct jobs waiting" : "No direct jobs match"
          }
          emptyDescription={
            status === DIRECT_JOB_PENDING ? "Nothing is in pending review." : "Try another status."
          }
        />
      )}
      {list?.recognized && list.total > 0 ? (
        <UrlPager page={page} pageSize={TRUST_PAGE_SIZE} total={list.total} />
      ) : null}
    </Stack>
  );
}
