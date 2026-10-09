import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobPageView } from "@/components/jobs/job-page-view";
import { JobPostingJsonLd } from "@/components/jobs/job-posting-json-ld";
import { loadSession } from "@/lib/auth/session";
import { loadSearchJob } from "@/lib/jobs/catalog";
import { loadAppliedJobIds, loadSavedJobIds } from "@/lib/me/load";
import { jobPageMetadata } from "@/lib/seo/job-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return jobPageMetadata(await loadSearchJob(id));
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, session] = await Promise.all([loadSearchJob(id), loadSession()]);
  if (!job) notFound();
  const jobs = [job];

  // On public pages, treat employees as guests: no candidate APIs, signedIn=false
  const isEmployeeSession = session?.company != null;
  const [savedIds, appliedIds] = !isEmployeeSession
    ? await Promise.all([loadSavedJobIds(), loadAppliedJobIds()])
    : [[], []];

  return (
    <>
      <JobPostingJsonLd job={job} />
      <JobPageView
        job={job}
        jobs={jobs}
        saved={savedIds.includes(job.id)}
        applied={appliedIds.includes(job.id)}
        signedIn={Boolean(session) && !isEmployeeSession}
      />
    </>
  );
}
