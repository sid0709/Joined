import { ROUTES } from "@/lib/routes";

import {
  MS_PER_HOUR,
  SITEMAP_HOME_CHANGE,
  SITEMAP_HOME_PRIORITY,
  SITEMAP_JOB_CHANGE,
  SITEMAP_JOB_LIMIT,
  SITEMAP_JOB_PRIORITY,
} from "./constants";

export { SITEMAP_JOB_LIMIT };

export type SitemapJob = {
  id: string;
  postedHoursAgo: number;
};

export type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: typeof SITEMAP_HOME_CHANGE | typeof SITEMAP_JOB_CHANGE;
  priority: number;
};

export function publicSitemapEntries(
  jobs: SitemapJob[],
  origin: string,
  now = new Date(),
): SitemapEntry[] {
  if (!origin) return [];
  const home: SitemapEntry = {
    url: `${origin}${ROUTES.search}`,
    lastModified: now,
    changeFrequency: SITEMAP_HOME_CHANGE,
    priority: SITEMAP_HOME_PRIORITY,
  };
  const jobEntries = jobs.slice(0, SITEMAP_JOB_LIMIT).map((job) => ({
    url: `${origin}${ROUTES.job(job.id)}`,
    lastModified: postedAt(job.postedHoursAgo, now),
    changeFrequency: SITEMAP_JOB_CHANGE,
    priority: SITEMAP_JOB_PRIORITY,
  }));
  return [home, ...jobEntries];
}

function postedAt(postedHoursAgo: number, now: Date): Date {
  return new Date(now.getTime() - Math.max(0, postedHoursAgo) * MS_PER_HOUR);
}
