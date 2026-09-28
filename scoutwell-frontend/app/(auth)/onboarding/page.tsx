import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadMeta, loadStats } from "@/lib/scout/load";

export const metadata: Metadata = { title: "Activate scout mode" };

export default async function OnboardingPage() {
  const [stats, meta] = await Promise.all([loadStats(), loadMeta()]);
  if (!stats) redirect(signInHref(ROUTES.onboarding));
  if (stats.profile.terms_accepted_at) redirect(ROUTES.dashboard);
  return <OnboardingForm name={stats.profile.name} meta={meta} />;
}
