import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubmitJobForm } from "@/components/submit/submit-job-form";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadMeta, loadStats } from "@/lib/scout/load";

export const metadata: Metadata = { title: "Submit a job" };

export default async function SubmitPage() {
  const [stats, meta] = await Promise.all([loadStats(), loadMeta()]);
  if (!stats) redirect(signInHref(ROUTES.submit));
  return <SubmitJobForm quota={stats.quota} level={stats.level} limits={meta.limits} />;
}
