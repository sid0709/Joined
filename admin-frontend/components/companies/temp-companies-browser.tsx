"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  CheckboxInput,
  EmptyState,
  HStack,
  Link,
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
import { MAX_MIGRATION_SELECTION } from "@/lib/migration";
import { ROUTES } from "@/lib/nav";
import { useAdminQuery } from "@/lib/use-admin-query";

type Notice = { status: "success" | "error"; title: string };

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
  return TEMP_COMPANY_PAGE_SIZES.some((size) => size === parsed)
    ? parsed
    : TEMP_COMPANIES_PAGE_SIZE;
}

type TempCompaniesBrowserProps = {
  title?: string;
  description?: string;
  /** Changing it reloads the list, e.g. when a copy or research run ends. */
  refreshKey?: number;
  /** Starts research for the checked companies and returns what to tell the admin. */
  onResearch?: (ids: string[]) => Promise<Notice>;
  maxSelection?: number;
};

/** Companies copied into staging. Published ones leave this list. */
export function TempCompaniesBrowser({
  title = "Staged companies",
  description = "Copied companies, busiest first. Research publishes the ones it finds; not found stay in this list.",
  refreshKey = 0,
  onResearch,
  maxSelection = MAX_MIGRATION_SELECTION,
}: TempCompaniesBrowserProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = pageSizeOption(searchParams.get("size"));
  const query = searchParams.get("q") ?? "";
  const hideNotFound = searchParams.get("hide") === "notFound";
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const overLimit = selected.length > maxSelection;

  async function researchSelected() {
    if (!onResearch) return;
    setNotice(null);
    try {
      setNotice(await onResearch(selected));
      setSelected([]);
    } catch (cause) {
      setNotice({
        status: "error",
        title: cause instanceof Error ? cause.message : "Could not research the companies",
      });
    }
  }

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
    <SectionCard
      title={title}
      description={description}
      action={
        onResearch ? (
          <Button
            label={selected.length ? `Research ${formatCount(selected.length)}` : "Research"}
            variant="primary"
            clickAction={researchSelected}
            isDisabled={selected.length === 0 || overLimit}
          />
        ) : undefined
      }
    >
      <Stack gap={5}>
        {overLimit ? (
          <Banner
            status="warning"
            title={`Select at most ${formatCount(maxSelection)} companies at a time.`}
          />
        ) : null}
        {notice ? (
          <Banner
            status={notice.status}
            title={notice.title}
            endContent={
              notice.status === "success" ? (
                <Link href={ROUTES.companies}>View companies</Link>
              ) : undefined
            }
          />
        ) : null}
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
          selection={onResearch ? "multiple" : "none"}
          selectedKeys={selected}
          onSelectionChange={setSelected}
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
