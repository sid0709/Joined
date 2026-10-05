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
  CASE_QUEUES,
  CASE_STATUSES,
  caseDue,
  caseListQueue,
  caseListStatus,
  caseQueueLabel,
  caseRecordQuery,
  casesListQuery,
  casesPath,
  isCompanyAtsReason,
  readCaseList,
  reasonCodeLabel,
  slaLabel,
  slaOverdue,
  type ModerationCase,
} from "@/lib/cases";
import { positiveInt } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import { TRUST_PAGE_SIZE, trustLoadError } from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

/** Reports, disputes, and fraud flags — staff GET /v1/admin/cases (docs/62 Layer H). */
export function ModerationCaseQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queue = caseListQueue(searchParams.get("queue"));
  const status = caseListStatus(searchParams.get("status"));
  const page = positiveInt(searchParams.get("page"), 1);
  const { result, loading, error, errorStatus } = useAdminQuery<unknown>(
    casesPath(queue, status, page),
  );
  const list = result ? readCaseList(result) : null;
  const message =
    list && !list.recognized
      ? "The API responded, but not with a case list."
      : error
        ? trustLoadError(errorStatus, error)
        : null;

  const go = useCallback(
    (next: { queue?: string; status?: string }) => {
      const path = casesListQuery(next.queue ?? queue, next.status ?? status, 1);
      router.push(`${ROUTES.cases}${path}`);
    },
    [queue, router, status],
  );

  const columns: TableColumn<ModerationCase>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.subjectId || "Untitled"}</Text>
          <Text type="supporting" color="secondary">
            {row.subjectType || row.status || "—"}
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
      key: "sla",
      header: "SLA",
      render: (row) => {
        const due = caseDue(row.queue || queue, row.createdAt, row.slaAt);
        return <Badge label={slaLabel(due)} variant={slaOverdue(due) ? "warning" : "neutral"} />;
      },
    },
  ];

  const showTable = Boolean(list?.recognized && list.rows.length);
  const queueLabel = caseQueueLabel(queue);
  return (
    <Stack gap={5}>
      <PageHeader
        title="Cases"
        description="Reports and fraud flags are due in 48 hours. Disputes are due in 5 business days. Company hiring reviews watch scam jobs, fake companies, and identity mismatches. A decision needs a reason."
        action={<Button label="Create case" variant="secondary" href={ROUTES.createCase} />}
      />
      <TabList
        value={queue}
        onChange={(value) => go({ queue: value })}
        hasDivider
        overflow="scroll"
      >
        {CASE_QUEUES.map((item) => (
          <Tab key={item.value} value={item.value} label={item.label} />
        ))}
      </TabList>
      <TabList value={status} onChange={(value) => go({ status: value })} overflow="scroll">
        {CASE_STATUSES.map((item) => (
          <Tab key={item.value} value={item.value} label={item.label} />
        ))}
      </TabList>
      {showTable ? (
        <Table
          caption={`${queueLabel} cases`}
          columns={columns}
          rows={list?.rows ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => {
            const query = caseRecordQuery(row);
            router.push(`${ROUTES.moderationCase(row.id)}${query ? `?${query}` : ""}`);
          }}
        />
      ) : (
        <TrustState
          loading={loading && !result}
          error={loading ? null : message}
          empty={!loading && !message}
          emptyTitle={`No ${status} ${queueLabel}`}
          emptyDescription="Nothing in this queue matches that status."
        />
      )}
      {list?.recognized && list.total > 0 ? (
        <UrlPager page={page} pageSize={TRUST_PAGE_SIZE} total={list.total} />
      ) : null}
    </Stack>
  );
}
