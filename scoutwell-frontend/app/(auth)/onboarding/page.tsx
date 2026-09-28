import type { Metadata } from "next";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Activate scout mode" };

export default function OnboardingPage() {
  return <OnboardingForm />;
}
