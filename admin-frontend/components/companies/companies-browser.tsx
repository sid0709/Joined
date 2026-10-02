"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Banner,
  EmptyState,
  HStack,
  PageHeader,
  Pagination,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@joined/design-system";
import { CompanyDrawer } from "@/components/companies/company-drawer";
import { CompletionBadge } from "@/components/directory/completion-badge";
import { DirectoryFilters } from "@/components/directory/directory-filters";
import { CompanyMark } from "@/components/jobs/company-mark";
import {
  COMPANIES_PAGE_SIZE,
  COMPANIES_PATH,
  COMPANY_SIZES,
  COMPANY_SORTS,
  COMPANY_TYPES,
  INDUSTRIES,
  companyLogoSrc,
  type CompanyDirectory,
  type CompanyRow,
} from "@/lib/company";
import {
  choiceOptions,
  directoryParams,
  sortValues,
  tableSort,
  yesNoOptions,
  type DirectoryFilter,
} from "@/lib/directory";
import { formatCount, formatDate, positiveInt } from "@/lib/format";
import { listingHref } from "@/lib/listing";
import { ROUTES } from "@/lib/nav";
import { VERIFICATION_APPROVED } from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

const FILTERS: DirectoryFilter[] = [
  { param: "industry", label: "Industry", options: choiceOptions("Any industry", INDUSTRIES) },
  { param: "size", label: "Size", options: choiceOptions("Any size", COMPANY_SIZES) },
  { param: "type", label: "Company type", options: choiceOptions("Any type", COMPANY_TYPES) },
  { param: "logo", label: "Logo", options: yesNoOptions("Logo or not", "Has a logo", "No logo") },
  {
    param: "verified",
    label: "Verified",
    options: yesNoOptions("Verified or not", "Verified", "Not verified"),
  },
];

const DEFAULT_SORT = { key: COMPANY_SORTS.name, direction: "asc" } as const;

function muted(value: string | number | undefined) {
  return <Text color="secondary">{value || "—"}</Text>;
}

/** Published companies: search, filter, and sort them; a row opens the editor. */
export function CompaniesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const companyId = searchParams.get("company");
  const params = directoryParams(searchParams, FILTERS, page, COMPANIES_PAGE_SIZE);
  const { result, loading, error, reload } = useAdminQuery<CompanyDirectory>(
    `${COMPANIES_PATH}?${params}`,
  );

  const go = useCallback(
    (values: Record<string, string | number | null>) =>
      router.replace(
        listingHref(ROUTES.companies, new URLSearchParams(window.location.search), values),
      ),
    [router],
  );

  const columns: TableColumn<CompanyRow>[] = [
    {
      key: COMPANY_SORTS.name,
      header: "Company",
      sortable: true,
      sortValue: (company) => company.name.toLowerCase(),
      render: (company) => (
        <HStack gap={3} vAlign="center">
          <CompanyMark name={company.name} logo={companyLogoSrc(company)} />
          <Stack gap={0.5}>
            <Text weight="semibold">{company.name || "Untitled"}</Text>
            <Text type="supporting" color="secondary">
              {company.tagline || company.url || "—"}
            </Text>
          </Stack>
        </HStack>
      ),
    },
    { key: "industry", header: "Industry", render: (company) => muted(company.industry) },
    { key: "size", header: "Size", render: (company) => muted(company.size) },
    { key: "companyType", header: "Type", render: (company) => muted(company.companyType) },
    {
      key: "headquarters",
      header: "Headquarters",
      render: (company) => muted(company.headquarters),
    },
    {
      key: COMPANY_SORTS.founded,
      header: "Founded",
      align: "end",
      sortable: true,
      sortValue: (company) => company.founded ?? 0,
      render: (company) => muted(company.founded),
    },
    {
      key: COMPANY_SORTS.jobs,
      header: "Jobs",
      align: "end",
      sortable: true,
      sortValue: (company) => company.jobCount,
      render: (company) => (
        <Text color="secondary" hasTabularNumbers>
          {formatCount(company.jobCount)}
        </Text>
      ),
    },
    {
      key: COMPANY_SORTS.completion,
      header: "Completion",
      align: "end",
      sortable: true,
      sortValue: (company) => company.completion,
      render: (company) => <CompletionBadge completion={company.completion} />,
    },
    {
      key: "verification",
      header: "Verified",
      render: (company) =>
        company.verification === VERIFICATION_APPROVED ? (
          <Badge label="Verified" variant="success" />
        ) : (
          muted("")
        ),
    },
    {
      key: COMPANY_SORTS.researched,
      header: "Researched",
      sortable: true,
      sortValue: (company) => company.researchedAt ?? "",
      render: (company) => muted(company.researchedAt ? formatDate(company.researchedAt) : ""),
    },
  ];

  const total = result?.total ?? 0;
  const filtered =
    FILTERS.some((filter) => searchParams.get(filter.param)) || searchParams.has("q");
  return (
    <Stack gap={5}>
      <PageHeader
        title="Companies"
        description="Published company pages: companies research found, and ones recruiters or scouts created. Saved name, website, logo, and profile show on Joined."
      />
      <DirectoryFilters
        current={searchParams}
        filters={FILTERS}
        search={{ label: "Search companies", placeholder: "Name, website, industry, place" }}
        summary={result ? `${formatCount(total)} companies` : "Loading"}
        onChange={go}
      />
      {error ? <Banner status="error" title={error} /> : null}
      <Table
        caption="Companies"
        columns={columns}
        rows={result?.companies ?? []}
        rowKey={(company) => company.id}
        loading={loading && !result}
        sort={tableSort(searchParams, DEFAULT_SORT)}
        onSortChange={(sort) => go(sortValues(sort))}
        onRowClick={(company) => go({ company: company.id })}
        empty={
          <EmptyState
            isCompact
            title={filtered ? "No companies match" : "No companies yet"}
            description={
              filtered
                ? "Try another search or fewer filters."
                : "Companies appear here once research publishes them, or a recruiter or scout creates one."
            }
          />
        }
      />
      {total > COMPANIES_PAGE_SIZE ? (
        <HStack hAlign="end">
          <Pagination
            page={page}
            totalItems={total}
            pageSize={COMPANIES_PAGE_SIZE}
            onChange={(next) => go({ page: next })}
            size="sm"
          />
        </HStack>
      ) : null}
      {companyId ? (
        <CompanyDrawer
          companyId={companyId}
          onClose={() => go({ company: null })}
          onSaved={reload}
        />
      ) : null}
    </Stack>
  );
}
