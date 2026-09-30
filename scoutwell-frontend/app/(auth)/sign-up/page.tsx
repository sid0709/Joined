import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { loadSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Become a scout" };

export default async function SignUpPage() {
  if (await loadSession()) redirect(ROUTES.dashboard);
  return <SignUpForm />;
}
