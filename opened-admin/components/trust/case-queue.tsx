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
  CASE_STATUSES,
  TRUST_PAGE_SIZE,
  caseListQuery,
  caseStatus,
  claimMethodLabel,
  companyCasesPath,
  readCaseList,
  trustLoadError,
  type TrustCase,
} from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

/** Pending company verification and claim cases. */
export function CompanyCaseQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = caseStatus(searchParams.get("status"));
  const page = positiveInt(searchParams.get("page"), 1);
  const { result, loading, error, errorStatus } = useAdminQuery<unknown>(
    companyCasesPath(status, page),
  );
  const list = result ? readCaseList(result) : null;
  const message =
    list && !list.recognized
      ? "The API responded, but not with a case list."
      : error
        ? trustLoadError(errorStatus, error)
        : null;

  const go = useCallback(
    (next: string) => router.push(`${ROUTES.companyVerification}${caseListQuery(next, 1)}`),
    [router],
  );

  const columns: TableColumn<TrustCase>[] = [
    {
      key: "company",
      header: "Company",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.title}</Text>
          <Text type="supporting" color="secondary">
            {row.company?.status || row.status}
          </Text>
        </Stack>
      ),
    },
    {
      key: "domain",
      header: "Domain",
      render: (row) => <Text color="secondary">{row.domain || "—"}</Text>,
    },
    {
      key: "method",
      header: "Claim method",
      render: (row) => <Text color="secondary">{claimMethodLabel(row.claimMethod)}</Text>,
    },
    {
      key: "members",
      header: "Members",
      align: "end",
      render: (row) => <Text hasTabularNumbers>{String(row.members.length)}</Text>,
    },
    {
      key: "age",
      header: "Waiting",
      render: (row) => <Badge label={ageLabel(row.createdAt)} variant="neutral" />,
    },
  ];

  const showTable = Boolean(list?.recognized && list.rows.length);
  return (
    <Stack gap={5}>
      <PageHeader
        title="Company claims"
        description="Verification and claim cases waiting on staff. Approve, reject, or suspend with a reason."
      />
      <TabList
        value={status || "all"}
        onChange={(value) => go(value === "all" ? "" : value)}
        hasDivider
        overflow="scroll"
      >
        {CASE_STATUSES.map((item) => (
          <Tab key={item.value || "all"} value={item.value || "all"} label={item.label} />
        ))}
      </TabList>
      {showTable ? (
        <Table
          caption="Company verification cases"
          columns={columns}
          rows={list?.rows ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(ROUTES.companyCase(row.id))}
        />
      ) : (
        <TrustState
          loading={loading && !result}
          error={loading ? null : message}
          empty={!loading && !message}
          emptyTitle={status === "pending" ? "No claims waiting" : "No cases match"}
          emptyDescription={
            status === "pending" ? "Nothing is waiting on verification." : "Try another status."
          }
        />
      )}
      {list?.recognized && list.total > 0 ? (
        <UrlPager page={page} pageSize={TRUST_PAGE_SIZE} total={list.total} />
      ) : null}
    </Stack>
  );
}
