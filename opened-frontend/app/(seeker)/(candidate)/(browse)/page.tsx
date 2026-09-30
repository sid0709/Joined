import type { Metadata } from "next";
import { JobSearch } from "@/components/jobs/job-search";
import { loadSession } from "@/lib/auth/session";
import { loadSearchCatalog } from "@/lib/jobs/catalog";
import { parseFilters, type Job } from "@/lib/jobs";
import { loadAppliedJobIds, loadProfile, loadSavedJobIds } from "@/lib/me/load";

export const metadata: Metadata = {
  title: "Find jobs",
  description:
    "Search jobs by title, skill, city, and workplace — including hidden jobs you won’t find on the big boards.",
};

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  let jobs: Job[] = [];
  let loadError: string | null = null;
  try {
    jobs = await loadSearchCatalog();
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : "Could not load jobs";
  }
  const session = await loadSession();
  const [savedIds, appliedIds, profile] = session
    ? await Promise.all([loadSavedJobIds(), loadAppliedJobIds(), loadProfile()])
    : [[], [], null];
  return (
    <JobSearch
      initialFilters={filters}
      jobs={jobs}
      loadError={loadError}
      savedIds={savedIds}
      appliedIds={appliedIds}
      signedIn={Boolean(session)}
      roleSuggestions={profile?.targetRoles}
      matchProfile={profile ?? undefined}
    />
  );
}
