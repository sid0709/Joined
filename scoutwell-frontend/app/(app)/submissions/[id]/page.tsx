import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApiError, type Earning, type List, type Submission } from "@openseat/scout";
import { SubmissionView } from "@/components/submissions/submission-view";
import { openedWebUrl } from "@/lib/config";
import { ROUTES, signInHref } from "@/lib/routes";
import { scoutGet } from "@/lib/scout/server";

export const metadata: Metadata = { title: "Submission" };

async function load(id: string) {
  try {
    return await Promise.all([
      scoutGet<Submission>(`/submissions/${encodeURIComponent(id)}`),
      scoutGet<List<Earning>>(`/earnings?submission_id=${encodeURIComponent(id)}&limit=100`),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [submission, earnings] = await load(id);
  if (!submission || !earnings) redirect(signInHref(ROUTES.submission(id)));
  const web = openedWebUrl();
  return (
    <SubmissionView
      submission={submission}
      earnings={earnings.data}
      jobHref={
        web && submission.job_id && !submission.expired ? `${web}/jobs/${submission.job_id}` : ""
      }
    />
  );
}
