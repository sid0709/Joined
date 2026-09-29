"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge, PageHeader, Stack, Table, Text, type TableColumn } from "@openseat/design-system";
import { UrlPager } from "@/components/scouting/url-pager";
import { TrustState } from "@/components/trust/trust-state";
import { ageLabel, positiveInt } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  TRUST_PAGE_SIZE,
  directJobsPath,
  readDirectJobList,
  trustLoadError,
  type AdminDirectJob,
} from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

/** Direct jobs in pending_review, separate from the jobs CMS. */
export function DirectJobQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const { result, loading, error, errorStatus } = useAdminQuery<unknown>(directJobsPath(page));
  const list = result ? readDirectJobList(result) : null;
  const message =
    list && !list.recognized
      ? "The API responded, but not with a direct-job list."
      : error
        ? trustLoadError(errorStatus, error)
        : null;

  const columns: TableColumn<AdminDirectJob>[] = [
    {
      key: "title",
      header: "Job",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.title}</Text>
          <Text type="supporting" color="secondary">
            {row.location || row.status}
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
      render: (row) => <Text color="secondary">{ageLabel(row.postedAt || row.createdAt)}</Text>,
    },
  ];

  const showTable = Boolean(list?.recognized && list.rows.length);
  return (
    <Stack gap={5}>
      <PageHeader
        title="Direct review"
        description="Company-posted jobs in pending review. Approving publishes the job. Reject chooses removed or draft."
      />
      {showTable ? (
        <Table
          caption="Direct jobs pending review"
          columns={columns}
          rows={list?.rows ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => {
            const params = new URLSearchParams();
            if (row.title) params.set("title", row.title);
            if (row.companyId) params.set("companyId", row.companyId);
            if (row.companyName) params.set("companyName", row.companyName);
            if (row.status) params.set("status", row.status);
            if (row.location) params.set("location", row.location);
            if (row.postedAt) params.set("postedAt", row.postedAt);
            if (row.createdAt) params.set("createdAt", row.createdAt);
            const query = params.toString();
            router.push(query ? `${ROUTES.directJob(row.id)}?${query}` : ROUTES.directJob(row.id));
          }}
        />
      ) : (
        <TrustState
          loading={loading && !result}
          error={loading ? null : message}
          empty={!loading && !message}
          emptyTitle="No direct jobs waiting"
          emptyDescription="Nothing is in pending review."
        />
      )}
      {list?.recognized && list.total > TRUST_PAGE_SIZE ? (
        <UrlPager page={page} pageSize={TRUST_PAGE_SIZE} total={list.total} />
      ) : null}
    </Stack>
  );
}
