"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { adminFetch } from "@/lib/api";
import { formatCount, pageWindow } from "@/lib/format";
import { SEARCH_DEBOUNCE_MS } from "@/lib/jobs";
import {
  SEARCH_JOBS_PAGE_SIZE,
  SEARCH_JOBS_PATH,
  type SearchJobList,
  type SearchRecord,
} from "@/lib/search-job";
import { SearchJobDrawer } from "@/components/jobs/search-job-drawer";

export function SearchJobsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const query = searchParams.get("q") ?? "";
  const jobId = searchParams.get("job");

  const requestKey = `${page}\n${query}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    result: SearchJobList | null;
    error: string | null;
  } | null>(null);
  const loading = snapshot?.key !== requestKey;
  const result = snapshot?.result ?? null;
  const loadError = loading ? null : (snapshot?.error ?? null);

  const onSearch = useCallback(
    (value: string) => {
      const current = new URLSearchParams(window.location.search);
      replaceListing(router, current, { q: value, page: 1, job: current.get("job") });
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(SEARCH_JOBS_PAGE_SIZE),
      q: query,
    });
    adminFetch<SearchJobList>(`${SEARCH_JOBS_PATH}?${params}`, { signal: controller.signal })
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
  }, [page, query, requestKey]);

  const total = result?.total ?? 0;
  const pageSize = result?.pageSize ?? SEARCH_JOBS_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Search records created from analyzed temp jobs.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField key={query} query={query} onSearch={onSearch} />
        <p className="text-sm text-muted">
          {loading && !result
            ? "Loading jobs"
            : `${formatCount(start)}–${formatCount(end)} of ${formatCount(total)}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {loadError ? (
          <p className="px-4 py-10 text-sm text-danger">{loadError}</p>
        ) : (
          <div className={`overflow-x-auto ${loading && result ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Workplace</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Pay</th>
                </tr>
              </thead>
              <tbody>
                {loading && !result
                  ? Array.from({ length: 6 }, (_, index) => (
                      <tr key={index} className="border-b border-line last:border-0">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="h-8 animate-pulse rounded-md bg-paper" />
                        </td>
                      </tr>
                    ))
                  : null}
                {result?.jobs.map((record) => (
                  <tr
                    key={record.tempJobId}
                    tabIndex={0}
                    aria-selected={record.tempJobId === jobId}
                    onClick={() =>
                      replaceListing(router, searchParams, {
                        q: query,
                        page,
                        job: record.tempJobId,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        replaceListing(router, searchParams, {
                          q: query,
                          page,
                          job: record.tempJobId,
                        });
                      }
                    }}
                    className={`cursor-pointer border-b border-line last:border-0 ${record.tempJobId === jobId ? "bg-accent-soft" : "hover:bg-paper/80"}`}
                  >
                    <td className="px-4 py-3 font-medium">{record.job.company}</td>
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 font-medium">{record.job.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {record.job.skills.slice(0, 4).join(" · ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">{record.job.workplace}</td>
                    <td className="px-4 py-3 text-muted">{record.job.seniority}</td>
                    <td className="px-4 py-3 text-muted">{payLabel(record)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result && result.jobs.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted">
                {query ? (
                  `No jobs match “${query}”.`
                ) : (
                  <>
                    No search records yet. Select jobs on{" "}
                    <Link href="/jobs/temp" className="underline">
                      Temp
                    </Link>{" "}
                    and analyze them.
                  </>
                )}
              </p>
            ) : null}
          </div>
        )}
        {result && total > pageSize ? (
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() =>
                replaceListing(router, searchParams, { q: query, page: page - 1, job: jobId })
              }
              className="h-8 rounded-md px-2 text-sm disabled:text-muted"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {pageWindow(page, pageCount).map((number) => (
                <button
                  key={number}
                  type="button"
                  aria-current={number === page ? "page" : undefined}
                  onClick={() =>
                    replaceListing(router, searchParams, { q: query, page: number, job: jobId })
                  }
                  className={`h-8 min-w-8 rounded-md px-2 text-sm ${number === page ? "bg-ink text-surface" : "hover:bg-paper"}`}
                >
                  {number}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() =>
                replaceListing(router, searchParams, { q: query, page: page + 1, job: jobId })
              }
              className="h-8 rounded-md px-2 text-sm disabled:text-muted"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {jobId ? (
        <SearchJobDrawer
          tempJobId={jobId}
          onClose={() => replaceListing(router, searchParams, { q: query, page, job: null })}
        />
      ) : null}
    </section>
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

function payLabel(record: SearchRecord) {
  const pay = record.job.pay;
  if (pay.min === 0 && pay.max === 0) return "Not listed";
  if (pay.period === "hour") return `${pay.currency} ${pay.min}–${pay.max}/hr`;
  return `${pay.currency} ${Math.round(pay.min / 1000)}k–${Math.round(pay.max / 1000)}k`;
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function replaceListing(
  router: ReturnType<typeof useRouter>,
  current: URLSearchParams,
  next: { q: string; page: number; job: string | null },
) {
  const params = new URLSearchParams(current.toString());
  if (next.q) params.set("q", next.q);
  else params.delete("q");
  if (next.page > 1) params.set("page", String(next.page));
  else params.delete("page");
  if (next.job) params.set("job", next.job);
  else params.delete("job");
  const search = params.toString();
  router.replace(search ? `/jobs?${search}` : "/jobs");
}
