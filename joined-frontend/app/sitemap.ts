import type { MetadataRoute } from "next";

import { joinedWebUrl } from "@/lib/config";
import { loadSearchCatalog } from "@/lib/jobs/catalog";
import { publicSitemapEntries, SITEMAP_JOB_LIMIT } from "@/lib/seo/sitemap";

export const dynamic = "force-dynamic";

/**
 * Public job URLs from GET /v1/search/jobs (no criteria). That catalog already
 * caps at 2000 jobs; this sitemap slices to the same limit.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = joinedWebUrl();
  if (!origin) return [];
  let jobs: { id: string; postedHoursAgo: number }[] = [];
  try {
    jobs = (await loadSearchCatalog()).slice(0, SITEMAP_JOB_LIMIT);
  } catch {
    jobs = [];
  }
  return publicSitemapEntries(jobs, origin);
}
