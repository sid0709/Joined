import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobPageView } from "@/components/jobs/job-page-view";
import { loadSession } from "@/lib/auth/session";
import { loadCompany, loadSearchJob } from "@/lib/jobs/catalog";
import { loadAppliedJobIds, loadSavedJobIds } from "@/lib/me/load";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await loadSearchJob(id);
  return { title: job ? `${job.title} at ${job.company}` : "Job", description: job?.summary };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await loadSearchJob(id);
  if (!job) notFound();

  let jobs = [job];
  if (job.companyId) {
    try {
      const company = await loadCompany(job.companyId);
      if (company && company.jobs.length > 0) jobs = company.jobs;
    } catch {
      jobs = [job];
    }
  }

  const session = await loadSession();
  // On public pages, treat employees (when company mode off) as guests; don't call candidate APIs
  const isEmployeeSession = session?.company != null;
  const [savedIds, appliedIds] = !isEmployeeSession
    ? await Promise.all([loadSavedJobIds(), loadAppliedJobIds()])
    : [[], []];

  return (
    <JobPageView
      job={job}
      jobs={jobs}
      saved={savedIds.includes(job.id)}
      applied={appliedIds.includes(job.id)}
      signedIn={Boolean(session)}
    />
  );
}
