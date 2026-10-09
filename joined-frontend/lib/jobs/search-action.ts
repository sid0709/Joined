"use server";

import { loadJobSearch, loadSavedJobSearch, loadSearchJob } from "./catalog";
import type { JobFilters, JobSearchPage } from "./search";
import type { Job } from "./types";

export async function searchJobs(
  filters: JobFilters,
  page: number,
  savedIds: string[],
): Promise<JobSearchPage> {
  if (filters.list === "saved") return loadSavedJobSearch(savedIds, filters, page);
  return loadJobSearch(filters, page);
}

export async function loadJob(id: string): Promise<Job | null> {
  return loadSearchJob(id);
}
