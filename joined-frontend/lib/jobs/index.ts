import { COMPANIES, JOBS } from "./data";

export * from "./types";
export * from "./company";
export * from "./format";
export * from "./match";
export * from "./my-match";
export * from "./search";
export { COMPANIES, JOBS };

/** Searches the job hunter ran recently — shown as one-tap chips under the search bar. */
export const RECENT_SEARCHES = [
  { q: "Product designer", where: "Chicago" },
  { q: "Design systems", where: "Remote" },
  { q: "UX research", where: "" },
];

export function jobById(id: string) {
  return JOBS.find((job) => job.id === id);
}

export function companyBySlug(slug: string) {
  return COMPANIES.find((company) => company.slug === slug);
}

export function jobsForCompany(id: string) {
  return JOBS.filter((job) => job.companyId === id);
}
