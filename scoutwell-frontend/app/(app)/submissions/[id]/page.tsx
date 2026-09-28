import type { Metadata } from "next";
import { SubmissionDetail } from "@/components/submissions/submission-detail";

export const metadata: Metadata = { title: "Submission" };

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubmissionDetail id={id} />;
}
