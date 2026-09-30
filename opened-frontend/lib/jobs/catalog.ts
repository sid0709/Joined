import { openedApiUrl } from "@/lib/config";
import type { Job, PublicCompany } from "./types";

const SEARCH_JOBS_PATH = "/v1/search/jobs";
const SEARCH_COMPANIES_PATH = "/v1/search/companies";

export type CompanyPage = {
  company: PublicCompany;
  jobs: Job[];
};

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

export type CompanyPageFilters = {
  department?: string;
  location?: string;
};

/** GET /v1/search/companies/:id — optional ?department=&location= careers filters. */
export async function loadCompany(
  id: string,
  filters?: CompanyPageFilters,
): Promise<CompanyPage | null> {
  const path = `${SEARCH_COMPANIES_PATH}/${encodeURIComponent(id)}`;
  const url = catalogUrl(path);
  const department = filters?.department?.trim();
  const location = filters?.location?.trim();
  if (department) url.searchParams.set("department", department);
  if (location) url.searchParams.set("location", location);
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Could not load company");
  }
  return (await response.json()) as CompanyPage;
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
