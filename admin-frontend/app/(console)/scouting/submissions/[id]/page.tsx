import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError, type AdminSubmissionDetail } from "@joined/scout";
import { ChecksCard } from "@/components/scouting/review/checks-card";
import { HistoryCard } from "@/components/scouting/review/history-card";
import { RelatedCard } from "@/components/scouting/review/related-card";
import { ReviewWorkspace } from "@/components/scouting/review/review-workspace";
import { ScoutCard } from "@/components/scouting/review/scout-card";
import { adminGet } from "@/lib/server/api";
import { joinedWebUrl } from "@/lib/server/env";

export const metadata: Metadata = { title: "Review submission" };

async function load(id: string) {
  try {
    return await adminGet<AdminSubmissionDetail>(
      `/v1/admin/scout/submissions/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await load(id);
  const web = joinedWebUrl();
  const sub = detail.submission;
  return (
    <ReviewWorkspace
      detail={detail}
      jobHref={web && sub.job_id && !sub.expired ? `${web}/jobs/${sub.job_id}` : ""}
      joinedOrigin={web}
      checks={<ChecksCard submission={sub} />}
      related={<RelatedCard detail={detail} />}
      scout={<ScoutCard summary={detail.scout} rule={detail.level_rule} />}
      history={<HistoryCard detail={detail} />}
    />
  );
}
