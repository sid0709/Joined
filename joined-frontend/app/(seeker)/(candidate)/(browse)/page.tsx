import type { Metadata } from "next";
import { cookies } from "next/headers";
import { JobSearch } from "@/components/jobs/job-search";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { loadSession } from "@/lib/auth/session";
import { loadJobSearch, loadSavedJobSearch } from "@/lib/jobs/catalog";
import {
  DEFAULT_FILTERS,
  parseFilters,
  parsePage,
  serializeFilters,
  type JobSearchPage,
  type SortKey,
} from "@/lib/jobs";
import { loadAppliedJobIds, loadProfile, loadSavedJobIds } from "@/lib/me/load";

export const metadata: Metadata = {
  title: "Find jobs",
  description:
    "Search jobs by title, skill, city, and workplace — including hidden jobs you won’t find on the big boards.",
};

const EMPTY_PAGE: JobSearchPage = { jobs: [], total: 0, page: 1 };
const RECOMMENDED_SORT: SortKey = "recommended";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = parseFilters(params);
  const page = parsePage(params);
  const isFirstCatalogPage = serializeFilters(parsed) === "" && page === 1;

  let catalog: JobSearchPage = EMPTY_PAGE;
  let result: JobSearchPage = EMPTY_PAGE;
  let loadError: string | null = null;

  const [session, firstPage] = await Promise.all([
    loadSession(),
    loadJobSearch(DEFAULT_FILTERS, 1).then(
      (pageResult) => ({ ok: true as const, pageResult }),
      (cause: unknown) => ({ ok: false as const, cause }),
    ),
  ]);

  // Signed in, the list is ranked for the hunter unless the link asks for another sort.
  const token = session ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  const filters = session && !params.sort ? { ...parsed, sort: RECOMMENDED_SORT } : parsed;

  if (!firstPage.ok) {
    loadError = firstPage.cause instanceof Error ? firstPage.cause.message : "Could not load jobs";
  } else {
    catalog = firstPage.pageResult;
    try {
      if (filters.list === "saved") {
        const savedIds = session ? await loadSavedJobIds() : [];
        result = await loadSavedJobSearch(savedIds, filters, page);
      } else if (isFirstCatalogPage && !token) {
        result = catalog;
      } else {
        result = await loadJobSearch(filters, page, token);
      }
    } catch (cause) {
      loadError = cause instanceof Error ? cause.message : "Could not load jobs";
    }
  }

  const [savedIds, appliedIds, profile] = session
    ? await Promise.all([loadSavedJobIds(), loadAppliedJobIds(), loadProfile()])
    : [[], [], null];

  return (
    <JobSearch
      initialFilters={filters}
      initialResult={result}
      catalogTotal={catalog.total}
      loadError={loadError}
      savedIds={savedIds}
      appliedIds={appliedIds}
      signedIn={Boolean(session)}
      roleSuggestions={profile?.targetRoles}
    />
  );
}
