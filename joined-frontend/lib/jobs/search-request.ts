import { SEARCH_PAGE_SIZE, type JobFilters, type PostedWithin, type SortKey } from "./search";

const POSTED_DAYS: Record<PostedWithin, number> = {
  any: 0,
  "24h": 1,
  "3d": 3,
  "7d": 7,
  "14d": 14,
};

const HIDDEN_SOURCE = "scouted";
const API_HIDDEN = "hidden";

function apiSort(sort: SortKey) {
  switch (sort) {
    case "recommended":
    case "relevance":
    case "newest":
    case "pay":
    case "applicants":
      return sort;
    default: {
      const unreachable: never = sort;
      return unreachable;
    }
  }
}

/** Query string for GET /v1/search/jobs. Always sets limit and sort so the API pages instead of returning the catalog. */
export function searchQuery(filters: JobFilters, page: number) {
  const params = new URLSearchParams();
  params.set("limit", String(SEARCH_PAGE_SIZE));
  params.set("sort", apiSort(filters.sort));
  if (page > 1) params.set("page", String(page));

  const q = filters.q.trim();
  if (q) params.set("q", q);
  const where = filters.where.trim();
  if (where) params.set("location", where);

  if (filters.workplace.length === 1 && filters.workplace[0] === "remote") {
    params.set("remote", "true");
  } else if (filters.workplace.length > 0) {
    params.set("workplace", filters.workplace.join(","));
  }
  if (filters.seniority.length > 0) params.set("seniority", filters.seniority.join(","));
  if (filters.employment.length > 0) params.set("employment", filters.employment.join(","));

  if (filters.source.length === 1 && filters.source[0] === HIDDEN_SOURCE) {
    params.set("source", API_HIDDEN);
  } else if (filters.source.length > 0) {
    params.set("source", filters.source.join(","));
  }

  if (filters.minPay > 0) params.set("salaryMin", String(filters.minPay));
  const postedDays = POSTED_DAYS[filters.posted];
  if (postedDays > 0) params.set("postedDays", String(postedDays));
  if (filters.visa) params.set("visa", "1");
  // "For you" is a server-side list: the strongest fits for the signed-in hunter.
  if (filters.list === "recommended") params.set("list", "recommended");
  return params;
}
