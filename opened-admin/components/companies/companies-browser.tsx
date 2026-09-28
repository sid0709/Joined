"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CompanyDrawer } from "@/components/companies/company-drawer";
import { CompanyMark } from "@/components/jobs/company-mark";
import { adminFetch } from "@/lib/api";
import {
  COMPANIES_PAGE_SIZE,
  COMPANIES_PATH,
  companyLogoSrc,
  type CompanyList,
} from "@/lib/company";
import { formatCount, pageWindow } from "@/lib/format";
import { SEARCH_DEBOUNCE_MS } from "@/lib/jobs";

export function CompaniesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positiveInt(searchParams.get("page"), 1);
  const query = searchParams.get("q") ?? "";
  const companyId = searchParams.get("company");
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = `${page}\n${query}\n${reloadToken}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    result: CompanyList | null;
    error: string | null;
  } | null>(null);
  const loading = snapshot?.key !== requestKey;
  const result = snapshot?.result ?? null;
  const loadError = loading ? null : (snapshot?.error ?? null);

  const onSearch = useCallback(
    (value: string) => {
      const current = new URLSearchParams(window.location.search);
      replaceListing(router, current, { q: value, page: 1, company: current.get("company") });
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(COMPANIES_PAGE_SIZE),
      q: query,
    });
    adminFetch<CompanyList>(`${COMPANIES_PATH}?${params}`, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setSnapshot({ key: requestKey, result: body, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setSnapshot({
          key: requestKey,
          result: null,
          error: cause instanceof Error ? cause.message : "Could not load companies",
        });
      });
    return () => controller.abort();
  }, [page, query, reloadToken, requestKey]);

  const total = result?.total ?? 0;
  const pageSize = result?.pageSize ?? COMPANIES_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          Edit the public company page. Saved name, website, logo, and profile show on Opened.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField key={query} query={query} onSearch={onSearch} />
        <p className="text-sm text-muted">
          {loading && !result
            ? "Loading companies"
            : `${formatCount(start)}–${formatCount(end)} of ${formatCount(total)}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {loadError ? (
          <p className="px-4 py-10 text-sm text-danger">{loadError}</p>
        ) : (
          <div className={`overflow-x-auto ${loading && result ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Website</th>
                  <th className="px-4 py-3 font-medium">Industry</th>
                  <th className="px-4 py-3 font-medium">Jobs</th>
                </tr>
              </thead>
              <tbody>
                {loading && !result
                  ? Array.from({ length: 6 }, (_, index) => (
                      <tr key={index} className="border-b border-line last:border-0">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="h-8 animate-pulse rounded-md bg-paper" />
                        </td>
                      </tr>
                    ))
                  : null}
                {result?.companies.map((company) => (
                  <tr
                    key={company.id}
                    tabIndex={0}
                    aria-selected={company.id === companyId}
                    onClick={() =>
                      replaceListing(router, searchParams, { q: query, page, company: company.id })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        replaceListing(router, searchParams, {
                          q: query,
                          page,
                          company: company.id,
                        });
                      }
                    }}
                    className={`cursor-pointer border-b border-line last:border-0 ${company.id === companyId ? "bg-accent-soft" : "hover:bg-paper/80"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CompanyMark
                          name={company.name}
                          logo={
                            company.logo || company.hasLogoFile
                              ? companyLogoSrc(company, reloadToken)
                              : undefined
                          }
                        />
                        <span className="font-medium">{company.name || "Untitled"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{company.url || "—"}</td>
                    <td className="px-4 py-3 text-muted">{company.industry || "—"}</td>
                    <td className="px-4 py-3 text-muted">{formatCount(company.jobCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result && result.companies.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted">
                {query ? `No companies match “${query}”.` : "No companies yet."}
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
                replaceListing(router, searchParams, {
                  q: query,
                  page: page - 1,
                  company: companyId,
                })
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
                    replaceListing(router, searchParams, {
                      q: query,
                      page: number,
                      company: companyId,
                    })
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
                replaceListing(router, searchParams, {
                  q: query,
                  page: page + 1,
                  company: companyId,
                })
              }
              className="h-8 rounded-md px-2 text-sm disabled:text-muted"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {companyId ? (
        <CompanyDrawer
          companyId={companyId}
          onClose={() => replaceListing(router, searchParams, { q: query, page, company: null })}
          onSaved={() => setReloadToken((token) => token + 1)}
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
      <span className="sr-only">Search companies</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search name or industry"
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

function replaceListing(
  router: ReturnType<typeof useRouter>,
  current: URLSearchParams,
  next: { q: string; page: number; company: string | null },
) {
  const params = new URLSearchParams(current.toString());
  if (next.q) params.set("q", next.q);
  else params.delete("q");
  if (next.page > 1) params.set("page", String(next.page));
  else params.delete("page");
  if (next.company) params.set("company", next.company);
  else params.delete("company");
  const search = params.toString();
  router.replace(search ? `/companies?${search}` : "/companies");
}
