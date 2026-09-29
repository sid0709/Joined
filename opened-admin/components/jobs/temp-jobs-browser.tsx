"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { adminFetch } from "@/lib/api";
import { formatCount, formatDate, jobLocation, pageWindow } from "@/lib/format";
import {
  ADMIN_SETTINGS_PATH,
  MAX_ANALYZE_SELECTION,
  SEARCH_DEBOUNCE_MS,
  TEMP_JOB_PAGE_SIZES,
  TEMP_JOBS_PAGE_SIZE,
  TEMP_JOBS_PATH,
  type CopyResult,
  type TempJob,
  type TempJobList,
} from "@/lib/jobs";
import { SEARCH_JOBS_PATH, type AnalyzeBatch } from "@/lib/search-job";
import { CompanyMark } from "@/components/jobs/company-mark";
import { JobDetailDrawer } from "@/components/jobs/job-detail-drawer";

export function TempJobsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = pageSizeOption(searchParams.get("size"));
  const query = searchParams.get("q") ?? "";
  const hideAnalyzed = searchParams.get("hide") === "analyzed";
  const jobId = searchParams.get("job");

  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${page}\n${pageSize}\n${query}\n${hideAnalyzed}\n${reloadToken}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    result: TempJobList | null;
    error: string | null;
  } | null>(null);
  const loading = snapshot?.key !== requestKey;
  const result = snapshot?.result ?? null;
  const loadError = loading ? null : (snapshot?.error ?? null);
  const [confirming, setConfirming] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeNotice, setAnalyzeNotice] = useState<{
    count: number;
    model: string;
    failed: number;
  } | null>(null);

  const onSearch = useCallback(
    (value: string) => {
      const current = new URLSearchParams(window.location.search);
      replaceListing(router, current, {
        q: value,
        page: 1,
        size: pageSizeOption(current.get("size")),
        hide: current.get("hide") === "analyzed",
        job: current.get("job"),
      });
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<{ model: string }>(ADMIN_SETTINGS_PATH, { signal: controller.signal })
      .then((body) => {
        if (!controller.signal.aborted) setModel(body.model);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      q: query,
    });
    if (hideAnalyzed) params.set("hide", "analyzed");
    adminFetch<TempJobList>(`${TEMP_JOBS_PATH}?${params}`, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setSnapshot({ key: requestKey, result: body, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setSnapshot({
          key: requestKey,
          result: null,
          error: cause instanceof Error ? cause.message : "Could not load jobs",
        });
      });
    return () => controller.abort();
  }, [hideAnalyzed, page, pageSize, query, reloadToken, requestKey]);

  const total = result?.total ?? 0;
  const shownPageSize = result?.pageSize ?? pageSize;
  const pageCount = Math.max(1, Math.ceil(total / shownPageSize));
  const start = total === 0 ? 0 : (page - 1) * shownPageSize + 1;
  const end = Math.min(page * shownPageSize, total);
  const listing = { q: query, page, size: pageSize, hide: hideAnalyzed, job: jobId };

  const pageIds = result?.jobs.map((job) => job._id) ?? [];
  const analyzed = new Set(result?.analyzedIds ?? []);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const selectionCount = selected.size;
  const overLimit = selectionCount > MAX_ANALYZE_SELECTION;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage(on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function analyzeSelected() {
    const ids = [...selected];
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeNotice(null);
    try {
      const batch = await adminFetch<AnalyzeBatch>(`${SEARCH_JOBS_PATH}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempJobIds: ids }),
      });
      const done = new Set(batch.analyzed.map((record) => record.tempJobId));
      setSelected((current) => {
        const next = new Set(current);
        for (const id of done) next.delete(id);
        return next;
      });
      setAnalyzeNotice({
        count: batch.analyzed.length,
        model: batch.model,
        failed: batch.failed.length,
      });
      if (batch.failed.length > 0) {
        setAnalyzeError(batch.failed.map((item) => item.error).join(" "));
      }
      setReloadToken((value) => value + 1);
    } catch (cause) {
      setAnalyzeError(cause instanceof Error ? cause.message : "Could not analyze the jobs");
    } finally {
      setAnalyzing(false);
    }
  }

  async function copyFromAthens() {
    setSyncing(true);
    setSyncError(null);
    setNotice(null);
    try {
      const copied = await adminFetch<CopyResult>(`${TEMP_JOBS_PATH}/sync`, { method: "POST" });
      setNotice(`Copied ${formatCount(copied.copied)} jobs into ${copied.destination}.`);
      setConfirming(false);
      setSelected(new Set());
      setReloadToken((value) => value + 1);
      replaceListing(router, searchParams, { ...listing, page: 1, job: null });
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : "Could not copy jobs");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Temp</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Select jobs, then analyze them with {model ? model : "the model in OPENAI_MODEL"}.
            Finished records show up on Jobs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
              setSyncError(null);
            }}
            disabled={syncing || analyzing}
            className="h-10 rounded-lg border border-line px-4 text-sm font-medium disabled:opacity-60"
          >
            {syncing ? "Copying…" : "Copy from Athens"}
          </button>
          <button
            type="button"
            onClick={analyzeSelected}
            disabled={analyzing || syncing || selectionCount === 0 || overLimit}
            className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-surface disabled:opacity-60"
          >
            {analyzing
              ? "Analyzing…"
              : selectionCount === 0
                ? "Analyze"
                : `Analyze ${formatCount(selectionCount)}`}
          </button>
        </div>
      </header>

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-danger-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-danger">
            This replaces every document in OpenedDB.temp_jobs with AthensDB.jobs.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={syncing}
              className="h-9 rounded-lg px-3 text-sm text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={copyFromAthens}
              disabled={syncing}
              className="h-9 rounded-lg bg-danger px-3 text-sm font-medium text-surface disabled:opacity-60"
            >
              {syncing ? "Copying…" : "Replace jobs"}
            </button>
          </div>
        </div>
      ) : null}

      {overLimit ? (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          Select at most {MAX_ANALYZE_SELECTION} jobs at a time.
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{notice}</p>
      ) : null}
      {analyzeNotice ? (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Analyzed {formatCount(analyzeNotice.count)}
          {analyzeNotice.model ? ` with ${analyzeNotice.model}` : ""}.{" "}
          <Link href="/jobs" className="underline">
            View them on Jobs
          </Link>
          {analyzeNotice.failed > 0
            ? ` ${formatCount(analyzeNotice.failed)} could not be analyzed.`
            : ""}
        </p>
      ) : null}
      {syncError || analyzeError ? (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {syncError ?? analyzeError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchField key={query} query={query} onSearch={onSearch} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideAnalyzed}
              onChange={(event) =>
                replaceListing(router, searchParams, {
                  ...listing,
                  page: 1,
                  hide: event.target.checked,
                })
              }
              className="size-4 accent-ink"
            />
            Hide analyzed
          </label>
          <label>
            <span className="sr-only">Jobs per page</span>
            <select
              value={pageSize}
              onChange={(event) =>
                replaceListing(router, searchParams, {
                  ...listing,
                  page: 1,
                  size: pageSizeOption(event.target.value),
                })
              }
              className="h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-ink"
            >
              {TEMP_JOB_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted">
            {loading && !result
              ? "Loading jobs"
              : `${formatCount(start)}–${formatCount(end)} of ${formatCount(total)}`}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {result && total > shownPageSize ? (
          <div className="border-b border-line">
            <Pager
              page={page}
              pageCount={pageCount}
              onPage={(next) => replaceListing(router, searchParams, { ...listing, page: next })}
            />
          </div>
        ) : null}
        {loadError ? (
          <p className="px-4 py-10 text-sm text-danger">{loadError}</p>
        ) : (
          <div className={`overflow-x-auto ${loading && result ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <PageSelect
                      checked={pageIds.length > 0 && pageSelected === pageIds.length}
                      indeterminate={pageSelected > 0 && pageSelected < pageIds.length}
                      onChange={togglePage}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Review</th>
                  <th className="px-4 py-3 font-medium">Posted</th>
                </tr>
              </thead>
              <tbody>
                {loading && !result
                  ? Array.from({ length: 8 }, (_, index) => (
                      <tr key={index} className="border-b border-line last:border-0">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="h-9 animate-pulse rounded-md bg-paper" />
                        </td>
                      </tr>
                    ))
                  : null}
                {result?.jobs.map((job) => (
                  <JobRow
                    key={job._id}
                    job={job}
                    open={job._id === jobId}
                    checked={selected.has(job._id)}
                    analyzed={analyzed.has(job._id)}
                    onToggle={() => toggle(job._id)}
                    onSelect={() =>
                      replaceListing(router, searchParams, { ...listing, job: job._id })
                    }
                  />
                ))}
              </tbody>
            </table>
            {result && result.jobs.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted">
                {query
                  ? `No jobs match “${query}”.`
                  : "No temp jobs yet. Copy them from Athens to fill this list."}
              </p>
            ) : null}
          </div>
        )}
        {result && total > shownPageSize ? (
          <div className="border-t border-line">
            <Pager
              page={page}
              pageCount={pageCount}
              onPage={(next) => replaceListing(router, searchParams, { ...listing, page: next })}
            />
          </div>
        ) : null}
      </div>

      {jobId ? (
        <JobDetailDrawer
          jobId={jobId}
          onClose={() => replaceListing(router, searchParams, { ...listing, job: null })}
          onSaved={() => setReloadToken((token) => token + 1)}
        />
      ) : null}
    </section>
  );
}

function PageSelect({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      ref={(node) => {
        if (node) node.indeterminate = indeterminate;
      }}
      type="checkbox"
      checked={checked}
      aria-label="Select jobs on this page"
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 accent-ink"
    />
  );
}

function JobRow({
  job,
  open,
  checked,
  analyzed,
  onToggle,
  onSelect,
}: {
  job: TempJob;
  open: boolean;
  checked: boolean;
  analyzed: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const source = [job.sourceCatalog, job.source].filter(Boolean).join(" · ");
  return (
    <tr
      tabIndex={0}
      aria-selected={open}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer border-b border-line last:border-0 ${open ? "bg-accent-soft" : "hover:bg-paper/80"}`}
    >
      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          aria-label={`Select ${job.title || "job"}`}
          onChange={onToggle}
          className="size-4 accent-ink"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <CompanyMark name={job.companyName} logo={job.metadata?.companyLogo} />
          <span className="font-medium">{job.companyName || "—"}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="line-clamp-2 font-medium">{job.title || "Untitled"}</p>
        {source ? <p className="mt-0.5 text-xs text-muted">{source}</p> : null}
      </td>
      <td className="max-w-56 px-4 py-3 text-muted">
        <p className="line-clamp-2">{jobLocation(job) || "—"}</p>
        {job.metadata?.details?.salary ? (
          <p className="mt-0.5 line-clamp-2 text-xs" title={job.metadata.details.salary}>
            {job.metadata.details.salary}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <ReviewLabel label={job.titleReviewLabel} />
          {analyzed ? <StatusPill label="Analyzed" /> : null}
          {!job.titleReviewLabel && !analyzed ? <span className="text-muted">—</span> : null}
        </div>
      </td>
      <td className="px-4 py-3 text-muted">{formatDate(job.postedAt)}</td>
    </tr>
  );
}

function ReviewLabel({ label }: { label?: string }) {
  if (!label) return null;
  const approved = label === "APPROVED";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${approved ? "bg-accent-soft text-accent" : "bg-paper text-muted"}`}
    >
      {label}
    </span>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-surface">
      {label}
    </span>
  );
}

function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="h-8 rounded-md px-2 text-sm text-ink disabled:text-muted"
      >
        Previous
      </button>
      <div className="flex gap-1">
        {pageWindow(page, pageCount).map((number) => (
          <button
            key={number}
            type="button"
            aria-current={number === page ? "page" : undefined}
            onClick={() => onPage(number)}
            className={`h-8 min-w-8 rounded-md px-2 text-sm ${number === page ? "bg-ink text-surface" : "text-ink hover:bg-paper"}`}
          >
            {number}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className="h-8 rounded-md px-2 text-sm text-ink disabled:text-muted"
      >
        Next
      </button>
    </div>
  );
}

function SearchField({ query, onSearch }: { query: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    if (draft === query) return;
    const timer = window.setTimeout(() => onSearch(draft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, onSearch, query]);

  return (
    <label className="block w-full max-w-md">
      <span className="sr-only">Search title or company</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search title or company"
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-ink"
      />
    </label>
  );
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function pageSizeOption(value: string | null) {
  const parsed = Number(value);
  if (TEMP_JOB_PAGE_SIZES.some((size) => size === parsed)) return parsed;
  return TEMP_JOBS_PAGE_SIZE;
}

function replaceListing(
  router: ReturnType<typeof useRouter>,
  current: URLSearchParams,
  next: { q: string; page: number; size: number; hide: boolean; job: string | null },
) {
  const params = new URLSearchParams(current.toString());
  if (next.q) params.set("q", next.q);
  else params.delete("q");
  if (next.page > 1) params.set("page", String(next.page));
  else params.delete("page");
  if (next.size !== TEMP_JOBS_PAGE_SIZE) params.set("size", String(next.size));
  else params.delete("size");
  if (next.hide) params.set("hide", "analyzed");
  else params.delete("hide");
  if (next.job) params.set("job", next.job);
  else params.delete("job");
  const search = params.toString();
  router.replace(search ? `/jobs/temp?${search}` : "/jobs/temp");
}
