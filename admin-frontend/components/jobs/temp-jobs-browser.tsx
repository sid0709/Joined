"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  CheckboxInput,
  EmptyState,
  HStack,
  Link,
  PageHeader,
  Pagination,
  Selector,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@joined/design-system";
import { CompanyMark } from "@/components/jobs/company-mark";
import { JobDetailDrawer } from "@/components/jobs/job-detail-drawer";
import { SearchBox } from "@/components/search-box";
import { adminFetch, adminSend } from "@/lib/api";
import { formatCount, formatDate, jobLocation, positiveInt } from "@/lib/format";
import {
  ADMIN_SETTINGS_PATH,
  MAX_ANALYZE_SELECTION,
  TEMP_JOB_PAGE_SIZES,
  TEMP_JOBS_PAGE_SIZE,
  TEMP_JOBS_PATH,
  type CopyResult,
  type TempJob,
  type TempJobList,
} from "@/lib/jobs";
import { listingHref } from "@/lib/listing";
import { ROUTES } from "@/lib/nav";
import { SEARCH_JOBS_PATH, type AnalyzeBatch } from "@/lib/search-job";
import { useAdminQuery } from "@/lib/use-admin-query";

const PAGE_SIZE_OPTIONS = TEMP_JOB_PAGE_SIZES.map((size) => ({
  value: String(size),
  label: `${size} per page`,
}));

type Row = TempJob & { id: string };

function pageSizeOption(value: string | null) {
  const parsed = Number(value);
  return TEMP_JOB_PAGE_SIZES.some((size) => size === parsed) ? parsed : TEMP_JOBS_PAGE_SIZE;
}

type TempJobsBrowserProps = {
  title?: string;
  description?: string;
  listPath?: string;
  route?: string;
  analyzePath?: string;
  allowCopy?: boolean;
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
  route = ROUTES.tempJobs,
  analyzePath = `${SEARCH_JOBS_PATH}/analyze`,
  allowCopy = true,
  details = true,
  searchLabel = "Search temp jobs",
  caption = "Temp jobs",
  emptyTitle = "No temp jobs yet",
  emptyDescription = "Copy them from Athens to fill this list.",
}: TempJobsBrowserProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = pageSizeOption(searchParams.get("size"));
  const query = searchParams.get("q") ?? "";
  const hideAnalyzed = searchParams.get("hide") === "analyzed";
  const jobId = searchParams.get("job");

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q: query });
  if (hideAnalyzed) params.set("hide", "analyzed");
  const { result, loading, error, reload } = useAdminQuery<TempJobList>(`${listPath}?${params}`);

  const [model, setModel] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<{ status: "success" | "error"; title: string } | null>(null);

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
  const overLimit = selected.length > MAX_ANALYZE_SELECTION;

  async function analyzeSelected() {
    setNotice(null);
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

  async function copyFromAthens() {
    setNotice(null);
    try {
      const copied = await adminFetch<CopyResult>(`${TEMP_JOBS_PATH}/sync`, { method: "POST" });
      setNotice({
        status: "success",
        title: `Copied ${formatCount(copied.copied)} jobs into ${copied.destination}.`,
      });
      setSelected([]);
      setConfirming(false);
      go({ page: 1, job: null });
      reload();
    } catch (cause) {
      setConfirming(false);
      setNotice({
        status: "error",
        title: cause instanceof Error ? cause.message : "Could not copy jobs",
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
  return (
    <Stack gap={5}>
      <PageHeader
        title={title}
        description={
          description ??
          `Select listings, then analyze them with ${model || "the model in OPENAI_MODEL"}. Finished records appear on Jobs.`
        }
        action={
          <HStack gap={2}>
            {allowCopy ? (
              <Button
                label="Copy from Athens"
                variant="secondary"
                clickAction={() => setConfirming(true)}
              />
            ) : null}
            <Button
              label={selected.length ? `Analyze ${formatCount(selected.length)}` : "Analyze"}
              variant="primary"
              clickAction={analyzeSelected}
              isDisabled={selected.length === 0 || overLimit}
            />
          </HStack>
        }
      />
      {overLimit ? (
        <Banner
          status="warning"
          title={`Select at most ${MAX_ANALYZE_SELECTION} jobs at a time.`}
        />
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
          <Selector
            label="Jobs per page"
            isLabelHidden
            options={PAGE_SIZE_OPTIONS}
            value={String(pageSize)}
            onChange={(value) =>
              go({ size: Number(value) === TEMP_JOBS_PAGE_SIZE ? null : value, page: 1 })
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
      {allowCopy ? (
        <AlertDialog
          isOpen={confirming}
          onOpenChange={setConfirming}
          title="Replace every temp job?"
          description="This replaces OpenedDB.temp_jobs with a fresh copy of AthensDB.jobs. Analyzed jobs and scouted jobs are not affected."
          actionLabel="Replace temp jobs"
          actionVariant="destructive"
          onAction={copyFromAthens}
        />
      ) : null}
      {details && jobId ? (
        <JobDetailDrawer jobId={jobId} onClose={() => go({ job: null })} onSaved={reload} />
      ) : null}
    </Stack>
  );
}
