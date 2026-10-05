"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  PageHeader,
  Stack,
  Tab,
  TabList,
  Table,
  Text,
  type TableColumn,
} from "sid-ui";
import { UrlPager } from "@/components/scouting/url-pager";
import { TrustState } from "@/components/trust/trust-state";
import {
  CASE_STATUSES,
  caseRecordQueryFromReport,
  isCompanyAtsReason,
  readReportList,
  reasonCodeLabel,
  reportListStatus,
  reportRecordQuery,
  reportsListQuery,
  reportsPath,
  type StaffReport,
} from "@/lib/cases";
import { ageLabel, positiveInt } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import { TRUST_PAGE_SIZE, trustLoadError } from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

/** Staff GET /v1/reports — filed reports with status filter and linked-case jump. */
export function ReportsQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = reportListStatus(searchParams.get("status"));
  const page = positiveInt(searchParams.get("page"), 1);
  const { result, loading, error, errorStatus } = useAdminQuery<unknown>(reportsPath(status, page));
  const list = result ? readReportList(result) : null;
  const message =
    list && !list.recognized
      ? "The API responded, but not with a report list."
      : error
        ? trustLoadError(errorStatus, error)
        : null;

  const go = useCallback(
    (next: string) => router.push(`${ROUTES.reports}${reportsListQuery(next, 1)}`),
    [router],
  );

  const columns: TableColumn<StaffReport>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.subjectId || "Untitled"}</Text>
          <Text type="supporting" color="secondary">
            {row.subjectType || "—"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (row) => (
        <Badge
          label={reasonCodeLabel(row.reasonCode)}
          variant={isCompanyAtsReason(row.reasonCode) ? "warning" : "neutral"}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Text color="secondary">{row.status || status}</Text>,
    },
    {
      key: "case",
      header: "Case",
      render: (row) => (
        <Text color="secondary" hasTabularNumbers>
          {row.caseId ? "Linked" : "—"}
        </Text>
      ),
    },
    {
      key: "age",
      header: "Filed",
      render: (row) => <Badge label={ageLabel(row.createdAt)} variant="neutral" />,
    },
  ];

  const showTable = Boolean(list?.recognized && list.rows.length);
  return (
    <Stack gap={5}>
      <PageHeader
        title="Reports"
        description="Filed staff and public reports. Open a row for detail, or jump to the linked reports case when one exists."
        action={<Button label="File report" variant="secondary" href={ROUTES.fileReport} />}
      />
      <TabList value={status} onChange={go} hasDivider overflow="scroll">
        {CASE_STATUSES.map((item) => (
          <Tab key={item.value} value={item.value} label={item.label} />
        ))}
      </TabList>
      {showTable ? (
        <Table
          caption="Staff reports"
          columns={columns}
          rows={list?.rows ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => {
            if (row.caseId) {
              const query = caseRecordQueryFromReport(row);
              router.push(`${ROUTES.moderationCase(row.caseId)}${query ? `?${query}` : ""}`);
              return;
            }
            const query = reportRecordQuery(row);
            router.push(`${ROUTES.report(row.id)}${query ? `?${query}` : ""}`);
          }}
        />
      ) : (
        <TrustState
          loading={loading && !result}
          error={loading ? null : message}
          empty={!loading && !message}
          emptyTitle={status === "open" ? "No open reports" : "No reports match"}
          emptyDescription={
            status === "open" ? "Nothing is waiting in the reports list." : "Try another status."
          }
        />
      )}
      {list?.recognized && list.total > 0 ? (
        <UrlPager page={page} pageSize={TRUST_PAGE_SIZE} total={list.total} />
      ) : null}
    </Stack>
  );
}
