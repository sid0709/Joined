"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Banner,
  CheckboxInput,
  EmptyState,
  HStack,
  Pagination,
  SectionCard,
  Selector,
  Stack,
  Table,
  Text,
  type BadgeVariant,
  type TableColumn,
} from "@joined/design-system";
import { CompanyMark } from "@/components/jobs/company-mark";
import { SearchBox } from "@/components/search-box";
import {
  STAGED_COMPANY_STATUS,
  TEMP_COMPANIES_PAGE_SIZE,
  TEMP_COMPANIES_PATH,
  TEMP_COMPANY_PAGE_SIZES,
  stagedCompanyStatusLabel,
  type StagedCompany,
  type StagedCompanyList,
  type StagedCompanyStatus,
} from "@/lib/company";
import { formatCount, formatDate, positiveInt } from "@/lib/format";
import { listingHref } from "@/lib/listing";
import { ROUTES } from "@/lib/nav";
import { useAdminQuery } from "@/lib/use-admin-query";

const PAGE_SIZE_OPTIONS = TEMP_COMPANY_PAGE_SIZES.map((size) => ({
  value: String(size),
  label: `${size} per page`,
}));

const STATUS_VARIANT: Record<StagedCompanyStatus, BadgeVariant> = {
  [STAGED_COMPANY_STATUS.waiting]: "neutral",
  [STAGED_COMPANY_STATUS.notFound]: "warning",
};

function pageSizeOption(value: string | null) {
  const parsed = Number(value);
  return TEMP_COMPANY_PAGE_SIZES.some((size) => size === parsed) ? parsed : TEMP_COMPANIES_PAGE_SIZE;
}

type TempCompaniesBrowserProps = {
  title?: string;
  description?: string;
  /** Changing it reloads the list, e.g. when a copy or research run ends. */
  refreshKey?: number;
};

/** Companies copied into staging. Published ones leave this list. */
export function TempCompaniesBrowser({
  title = "Staged companies",
  description = "Copied companies, busiest first. Research publishes the ones it finds; not found stay in this list.",
  refreshKey = 0,
}: TempCompaniesBrowserProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = pageSizeOption(searchParams.get("size"));
  const query = searchParams.get("q") ?? "";
  const hideNotFound = searchParams.get("hide") === "notFound";

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q: query });
  if (hideNotFound) params.set("hide", "notFound");
  const { result, loading, error, reload } = useAdminQuery<StagedCompanyList>(
    `${TEMP_COMPANIES_PATH}?${params}`,
  );

  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey, reload]);

  const go = useCallback(
    (values: Record<string, string | number | null>) =>
      router.replace(
        listingHref(ROUTES.companyMigration, new URLSearchParams(window.location.search), values),
      ),
    [router],
  );

  const columns: TableColumn<StagedCompany>[] = [
    {
      key: "name",
      header: "Company",
      render: (company) => (
        <HStack gap={3} vAlign="center">
          <CompanyMark name={company.name} logo={company.logo} />
          <Stack gap={0.5}>
            <Text weight="semibold">{company.name || "Untitled"}</Text>
            <Text type="supporting" color="secondary">
              {company.url || "—"}
            </Text>
          </Stack>
        </HStack>
      ),
    },
    {
      key: "jobs",
      header: "Jobs",
      align: "end",
      render: (company) => (
        <Text color="secondary" hasTabularNumbers>
          {formatCount(company.jobCount)}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Research",
      render: (company) => (
        <Badge
          label={stagedCompanyStatusLabel(company.status)}
          variant={STATUS_VARIANT[company.status]}
        />
      ),
    },
    {
      key: "researchedAt",
      header: "Researched",
      align: "end",
      render: (company) => (
        <Text type="supporting" color="secondary">
          {formatDate(company.researchedAt)}
        </Text>
      ),
    },
  ];

  const total = result?.total ?? 0;
  return (
    <SectionCard title={title} description={description}>
      <Stack gap={5}>
        {error ? <Banner status="error" title={error} /> : null}
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <HStack width={360}>
            <SearchBox
              key={query}
              value={query}
              label="Search staged companies"
              placeholder="Name or website"
              onSearch={(value) => go({ q: value, page: 1 })}
            />
          </HStack>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <CheckboxInput
              label="Hide not found"
              value={hideNotFound}
              onChange={(checked) => go({ hide: checked ? "notFound" : null, page: 1 })}
            />
            <Selector
              label="Companies per page"
              isLabelHidden
              options={PAGE_SIZE_OPTIONS}
              value={String(pageSize)}
              onChange={(value) =>
                go({ size: Number(value) === TEMP_COMPANIES_PAGE_SIZE ? null : value, page: 1 })
              }
            />
            <Text type="supporting" color="secondary">
              {result ? `${formatCount(total)} companies` : "Loading"}
            </Text>
          </HStack>
        </HStack>
        <Table
          caption="Staged companies"
          columns={columns}
          rows={result?.companies ?? []}
          rowKey={(company) => company.id}
          loading={loading && !result}
          empty={
            <EmptyState
              isCompact
              title={query ? `No companies match "${query}"` : "No staged companies yet"}
              description={
                query ? "Try another search." : "Copy them from Athens to fill this list."
              }
            />
          }
        />
        {total > pageSize ? (
          <HStack hAlign="end">
            <Pagination
              page={page}
              totalItems={total}
              pageSize={pageSize}
              onChange={(next) => go({ page: next })}
              size="sm"
            />
          </HStack>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
