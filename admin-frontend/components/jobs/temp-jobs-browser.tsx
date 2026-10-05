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
  PageHeader,
  Pagination,
  SectionCard,
  Selector,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "sid-ui";
import { CompanyMark } from "@/components/jobs/company-mark";
import { JobDetailDrawer } from "@/components/jobs/job-detail-drawer";
import { PageSelectButton } from "@/components/page-select-button";
import { SearchBox } from "@/components/search-box";
import { adminFetch, adminSend } from "@/lib/api";
import { formatCount, formatDate, jobLocation, positiveInt } from "@/lib/format";
import {
  ADMIN_SETTINGS_PATH,
  MAX_ANALYZE_SELECTION,
  TEMP_JOB_PAGE_SIZES,
  TEMP_JOBS_PAGE_SIZE,
  TEMP_JOBS_PATH,
  type TempJob,
  type TempJobList,
} from "@/lib/jobs";
import { listingHref } from "@/lib/listing";
import { ROUTES } from "@/lib/nav";
import type { AnalyzeBatch } from "@/lib/search-job";
import { useAdminQuery } from "@/lib/use-admin-query";

type Row = TempJob & { id: string };

function pageSizeOption(value: string | null, sizes: readonly number[], fallback: number) {
  const parsed = Number(value);
  return sizes.some((size) => size === parsed) ? parsed : fallback;
}

type Notice = { status: "success" | "error"; title: string };

type TempJobsBrowserProps = {
  title?: string;
  description?: string;
  listPath?: string;
  route?: string;
  /** Where to POST a selection and wait for the analyzed batch. */
  analyzePath?: string;
  /**
   * Starts the analysis itself instead of waiting on analyzePath, and returns what to
   * tell the admin. Selections up to maxSelection are allowed.
   */
  onAnalyze?: (ids: string[]) => Promise<Notice>;
  maxSelection?: number;
  /** Rows offered in the page-size menu. Scout stays on the smaller set. */
  pageSizes?: readonly number[];
  /** Changing it reloads the list, e.g. when a background analysis ends. */
  refreshKey?: number;
  /** "section" renders a card inside a larger page instead of the page header. */
  layout?: "page" | "section";
  details?: boolean;
  searchLabel?: string;
  caption?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

/** Scraped listings copied from Athens; pick some and analyze them into public jobs. */
export function TempJobsBrowser({
  title = "Temp jobs",
  description,
  listPath = TEMP_JOBS_PATH,
  route = ROUTES.jobMigration,
  analyzePath,
  onAnalyze,
  maxSelection = MAX_ANALYZE_SELECTION,
  pageSizes = TEMP_JOB_PAGE_SIZES,
  refreshKey = 0,
  layout = "page",
  details = true,
  searchLabel = "Search temp jobs",
  caption = "Temp jobs",
  emptyTitle = "No temp jobs yet",
  emptyDescription = "Copy them from Athens to fill this list.",
}: TempJobsBrowserProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const defaultPageSize = pageSizes[0] ?? TEMP_JOBS_PAGE_SIZE;
  const pageSize = pageSizeOption(searchParams.get("size"), pageSizes, defaultPageSize);
  const pageSizeOptions = pageSizes.map((size) => ({
    value: String(size),
    label: `${size} per page`,
  }));
  const query = searchParams.get("q") ?? "";
  const hideAnalyzed = searchParams.get("hide") === "analyzed";
  const jobId = searchParams.get("job");

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q: query });
  if (hideAnalyzed) params.set("hide", "analyzed");
  const { result, loading, error, reload } = useAdminQuery<TempJobList>(`${listPath}?${params}`);

  const [model, setModel] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey, reload]);

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<{ model: string }>(ADMIN_SETTINGS_PATH, { signal: controller.signal })
      .then((body) => {
        if (!controller.signal.aborted) setModel(body.model);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const go = useCallback(
    (values: Record<string, string | number | null>) =>
      router.replace(listingHref(route, new URLSearchParams(window.location.search), values)),
    [router, route],
  );

  const analyzed = new Set(result?.analyzedIds ?? []);
  const overLimit = selected.length > maxSelection;

  async function analyzeSelected() {
    setNotice(null);
    if (onAnalyze) {
      try {
        setNotice(await onAnalyze(selected));
        setSelected([]);
      } catch (cause) {
        setNotice({
          status: "error",
          title: cause instanceof Error ? cause.message : "Could not analyze the jobs",
        });
      }
      return;
    }
    if (!analyzePath) return;
    try {
      const batch = await adminSend<AnalyzeBatch>(analyzePath, "POST", {
        tempJobIds: selected,
      });
      const done = new Set(batch.analyzed.map((record) => record.tempJobId));
      setSelected((current) => current.filter((id) => !done.has(id)));
      const failed = batch.failed.length
        ? ` ${formatCount(batch.failed.length)} failed: ${batch.failed.map((item) => item.error).join(" ")}`
        : "";
      setNotice({
        status: batch.failed.length ? "error" : "success",
        title: `Analyzed ${formatCount(batch.analyzed.length)}${batch.model ? ` with ${batch.model}` : ""}.${failed}`,
      });
      reload();
    } catch (cause) {
      setNotice({
        status: "error",
        title: cause instanceof Error ? cause.message : "Could not analyze the jobs",
      });
    }
  }

  const columns: TableColumn<Row>[] = [
    {
      key: "company",
      header: "Company",
      render: (job) => (
        <HStack gap={3} vAlign="center">
          <CompanyMark name={job.companyName} logo={job.metadata?.companyLogo} />
          <Text weight="medium">{job.companyName || "—"}</Text>
        </HStack>
      ),
    },
    {
      key: "title",
      header: "Title",
      render: (job) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{job.title || "Untitled"}</Text>
          <Text type="supporting" color="secondary">
            {[job.sourceCatalog, job.source].filter(Boolean).join(" · ")}
          </Text>
        </Stack>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (job) => (
        <Stack gap={0.5}>
          <Text color="secondary">{jobLocation(job) || "—"}</Text>
          {job.metadata?.details?.salary ? (
            <Text type="supporting" color="secondary">
              {job.metadata.details.salary}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: "review",
      header: "Review",
      render: (job) => (
        <HStack gap={1} wrap="wrap">
          {job.titleReviewLabel ? (
            <Badge
              label={job.titleReviewLabel}
              variant={job.titleReviewLabel === "APPROVED" ? "success" : "neutral"}
            />
          ) : null}
          {analyzed.has(job._id) ? <Badge label="Analyzed" variant="blue" /> : null}
        </HStack>
      ),
    },
    {
      key: "postedAt",
      header: "Posted",
      align: "end",
      render: (job) => (
        <Text type="supporting" color="secondary">
          {formatDate(job.postedAt)}
        </Text>
      ),
    },
  ];

  const total = result?.total ?? 0;
  const heading = {
    title,
    description:
      description ??
      `Select listings, then analyze them with ${model || "the model in OPENAI_MODEL"}. Finished records appear on Jobs.`,
    action: (
      <Button
        label={selected.length ? `Analyze ${formatCount(selected.length)}` : "Analyze"}
        variant="primary"
        clickAction={analyzeSelected}
        isDisabled={selected.length === 0 || overLimit}
      />
    ),
  };
  const body = (
    <Stack gap={5}>
      {overLimit ? (
        <Banner status="warning" title={`Select at most ${maxSelection} jobs at a time.`} />
      ) : null}
      {notice ? (
        <Banner
          status={notice.status}
          title={notice.title}
          endContent={
            notice.status === "success" ? <Link href={ROUTES.jobs}>View jobs</Link> : undefined
          }
        />
      ) : null}
      {error ? <Banner status="error" title={error} /> : null}
      <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
        <HStack width={360}>
          <SearchBox
            key={query}
            value={query}
            label={searchLabel}
            placeholder="Title or company"
            onSearch={(value) => go({ q: value, page: 1 })}
          />
        </HStack>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <CheckboxInput
            label="Hide analyzed"
            value={hideAnalyzed}
            onChange={(checked) => go({ hide: checked ? "analyzed" : null, page: 1 })}
          />
          <PageSelectButton
            selected={selected}
            pageIds={(result?.jobs ?? []).map((job) => job._id)}
            onChange={setSelected}
          />
          <Selector
            label="Jobs per page"
            isLabelHidden
            options={pageSizeOptions}
            value={String(pageSize)}
            onChange={(value) =>
              go({ size: Number(value) === defaultPageSize ? null : value, page: 1 })
            }
          />
          <Text type="supporting" color="secondary">
            {result ? `${formatCount(total)} jobs` : "Loading"}
          </Text>
        </HStack>
      </HStack>
      <Table
        caption={caption}
        columns={columns}
        rows={(result?.jobs ?? []).map((job) => ({ ...job, id: job._id }))}
        rowKey={(job) => job.id}
        selection="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        loading={loading && !result}
        onRowClick={details ? (job) => go({ job: job.id }) : undefined}
        empty={
          <EmptyState
            isCompact
            title={query ? `No jobs match "${query}"` : emptyTitle}
            description={query ? "Try another search." : emptyDescription}
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
      {details && jobId ? (
        <JobDetailDrawer jobId={jobId} onClose={() => go({ job: null })} onSaved={reload} />
      ) : null}
    </Stack>
  );
  if (layout === "section") {
    return <SectionCard {...heading}>{body}</SectionCard>;
  }
  return (
    <Stack gap={5}>
      <PageHeader {...heading} />
      {body}
    </Stack>
  );
}
