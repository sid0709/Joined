import type { Metadata } from "next";
import { JobSearch } from "@/components/jobs/job-search";
import { parseFilters } from "@/lib/jobs";

export const metadata: Metadata = {
  title: "Find jobs",
  description:
    "Search jobs by title, skill, city, and workplace — including hidden jobs you won’t find on the big boards.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  return <JobSearch initialFilters={filters} />;
}
