import type { Metadata } from "next";

import { joinedWebUrl } from "@/lib/config";
import type { Job } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";

import { FALLBACK_JOB_TITLE } from "./constants";

export function jobPageTitle(job: Job): string {
  const location = job.location.trim();
  const base = `${job.title} at ${job.company}`;
  return location ? `${base} · ${location}` : base;
}

export function jobPageDescription(job: Job): string {
  const summary = job.summary.trim();
  if (summary) return summary;
  const location = job.location.trim();
  const base = `${job.title} at ${job.company}`;
  return location ? `${base} in ${location}` : base;
}

export function absoluteJobPageUrl(id: string, origin = joinedWebUrl()): string | undefined {
  if (!origin) return undefined;
  return `${origin}${ROUTES.job(id)}`;
}

export function jobPageMetadata(job: Job | null, origin = joinedWebUrl()): Metadata {
  if (!job) {
    return { title: FALLBACK_JOB_TITLE, robots: { index: false, follow: false } };
  }
  const title = jobPageTitle(job);
  const description = jobPageDescription(job);
  const url = absoluteJobPageUrl(job.id, origin);
  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
  };
}
