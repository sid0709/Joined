import { openedApiUrl } from "@/lib/config";
import type { Job } from "./types";

const SEARCH_JOBS_PATH = "/v1/search/jobs";

type CatalogResponse = {
  jobs: Job[];
  total: number;
};

export async function loadSearchCatalog(): Promise<Job[]> {
  const response = await fetch(catalogUrl(SEARCH_JOBS_PATH), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load jobs");
  }
  const body = (await response.json()) as CatalogResponse;
  return body.jobs ?? [];
}

export async function loadSearchJob(id: string): Promise<Job | null> {
  const response = await fetch(catalogUrl(`${SEARCH_JOBS_PATH}/${encodeURIComponent(id)}`), {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Could not load job");
  }
  return (await response.json()) as Job;
}

function catalogUrl(path: string) {
  return new URL(path, `${openedApiUrl()}/`);
}
