"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
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
import { CompanyMark } from "@/components/jobs/company-mark";
import { SearchBox } from "@/components/search-box";
import {
  COMPANIES_PAGE_SIZE,
  COMPANIES_PATH,
  companyLogoSrc,
  type CompanyList,
  type CompanySummary,
} from "@/lib/company";
import { formatCount, positiveInt } from "@/lib/format";
import { listingHref } from "@/lib/listing";
import { ROUTES } from "@/lib/nav";
import { useAdminQuery } from "@/lib/use-admin-query";

/** Every company page; a row opens the editor. */
export function CompaniesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const query = searchParams.get("q") ?? "";
  const companyId = searchParams.get("company");
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(COMPANIES_PAGE_SIZE),
    q: query,
  });
  const { result, loading, error, reload } = useAdminQuery<CompanyList>(
    `${COMPANIES_PATH}?${params}`,
  );

  const go = useCallback(
    (values: Record<string, string | number | null>) =>
      router.replace(
        listingHref(ROUTES.companies, new URLSearchParams(window.location.search), values),
      ),
    [router],
  );

  const columns: TableColumn<CompanySummary>[] = [
    {
      key: "name",
      header: "Company",
      render: (company) => (
        <HStack gap={3} vAlign="center">
          <CompanyMark name={company.name} logo={companyLogoSrc(company)} />
          <Text weight="semibold">{company.name || "Untitled"}</Text>
        </HStack>
      ),
    },
    {
      key: "url",
      header: "Website",
      render: (company) => <Text color="secondary">{company.url || "—"}</Text>,
    },
    {
      key: "industry",
      header: "Industry",
      render: (company) => <Text color="secondary">{company.industry || "—"}</Text>,
    },
    {
      key: "jobCount",
      header: "Jobs",
      align: "end",
      render: (company) => (
        <Text color="secondary" hasTabularNumbers>
          {formatCount(company.jobCount)}
        </Text>
      ),
    },
  ];

  const total = result?.total ?? 0;
  return (
    <Stack gap={5}>
      <PageHeader
        title="Companies"
        description="Public company pages. Saved name, website, logo, and profile show on Joined."
      />
      <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
        <HStack width={360}>
          <SearchBox
            key={query}
            value={query}
            label="Search companies"
            placeholder="Name or industry"
            onSearch={(value) => go({ q: value, page: 1 })}
          />
        </HStack>
        <Text type="supporting" color="secondary">
          {result ? `${formatCount(total)} companies` : "Loading"}
        </Text>
      </HStack>
      {error ? <Banner status="error" title={error} /> : null}
      <Table
        caption="Companies"
        columns={columns}
        rows={result?.companies ?? []}
        rowKey={(company) => company.id}
        loading={loading && !result}
        onRowClick={(company) => go({ company: company.id })}
        empty={
          <EmptyState
            isCompact
            title={query ? `No companies match "${query}"` : "No companies yet"}
            description={
              query
                ? "Try another search."
                : "Companies appear as jobs are copied, posted, or scouted."
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
