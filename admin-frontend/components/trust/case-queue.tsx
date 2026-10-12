"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge, PageHeader, Stack, Tab, TabList, Table, Text, type TableColumn } from "sid-ui";
import { UrlPager } from "@/components/scouting/url-pager";
import { TrustState } from "@/components/trust/trust-state";
import { ageLabel, positiveInt } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  TRUST_PAGE_SIZE,
  VERIFICATION_PENDING,
  VERIFICATION_STATUSES,
  claimMethodLabel,
  readVerificationList,
  trustLoadError,
  verificationListQuery,
  verificationListStatus,
  verificationsPath,
  type VerificationRow,
} from "@/lib/trust";
import { useAdminQuery, useWarmNextPage } from "@/lib/use-admin-query";
import { useListingSearch } from "@/lib/use-listing-search";

/** Pending company verification and claim requests. */
export function CompanyCaseQueue() {
  const router = useRouter();
  const { searchParams, commit } = useListingSearch();
  const status = verificationListStatus(searchParams.get("status"));
  const page = positiveInt(searchParams.get("page"), 1);
  const path = verificationsPath(status, page);
  const { result, loading, error, errorStatus } = useAdminQuery<unknown>(path);
  const list = result ? readVerificationList(result) : null;
  useWarmNextPage(path, page, TRUST_PAGE_SIZE, list?.total);
  const message =
    list && !list.recognized
      ? "The API responded, but not with a verification list."
      : error
        ? trustLoadError(errorStatus, error)
        : null;

  const go = useCallback(
    (next: string) => commit(`${ROUTES.companyVerification}${verificationListQuery(next, 1)}`),
    [commit],
  );

  const columns: TableColumn<VerificationRow>[] = [
    {
      key: "company",
      header: "Company",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.companyName || "Untitled"}</Text>
          <Text type="supporting" color="secondary">
            {row.requestedBy || row.status}
          </Text>
        </Stack>
      ),
    },
    {
      key: "domain",
      header: "Domains",
      render: (row) => <Text color="secondary">{row.domains.join(", ") || "—"}</Text>,
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
      render: (row) => <Text hasTabularNumbers>{String(row.memberCount)}</Text>,
    },
    {
      key: "age",
      header: "Waiting",
      render: (row) => <Badge label={ageLabel(row.slaAt || row.createdAt)} variant="neutral" />,
    },
  ];

  const showTable = Boolean(list?.recognized && list.rows.length);
  return (
    <Stack gap={5}>
      <PageHeader
        title="Company claims"
        description="Verification and claim requests. Approve, reject, or suspend with a reason."
      />
      <TabList value={status} onChange={go} hasDivider overflow="scroll">
        {VERIFICATION_STATUSES.map((item) => (
          <Tab key={item.value} value={item.value} label={item.label} />
        ))}
      </TabList>
      {showTable ? (
        <Table
          caption="Company verifications"
          columns={columns}
          rows={list?.rows ?? []}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(ROUTES.companyCase(row.companyId))}
        />
      ) : (
        <TrustState
          loading={loading && !result}
          error={loading ? null : message}
          empty={!loading && !message}
          emptyTitle={status === VERIFICATION_PENDING ? "No claims waiting" : "No claims match"}
          emptyDescription={
            status === VERIFICATION_PENDING
              ? "Nothing is waiting on verification."
              : "Try another status."
          }
        />
      )}
      {list?.recognized && list.total > 0 ? (
        <UrlPager
          page={page}
          pageSize={TRUST_PAGE_SIZE}
          total={list.total}
          onPageChange={(next) =>
            commit(`${ROUTES.companyVerification}${verificationListQuery(status, next)}`)
          }
        />
      ) : null}
    </Stack>
  );
}
