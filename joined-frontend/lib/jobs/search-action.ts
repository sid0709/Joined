"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { loadJobSearch, loadSavedJobSearch, loadSearchJob } from "./catalog";
import type { JobFilters, JobSearchPage } from "./search";
import type { Job } from "./types";

export async function searchJobs(
  filters: JobFilters,
  page: number,
  savedIds: string[],
): Promise<JobSearchPage> {
  if (filters.list === "saved") return loadSavedJobSearch(savedIds, filters, page);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return loadJobSearch(filters, page, token);
}

export async function loadJob(id: string): Promise<Job | null> {
  return loadSearchJob(id);
}
