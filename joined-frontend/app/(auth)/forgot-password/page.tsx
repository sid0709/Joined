import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { loadSession, safeNextPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = safeNextPath((await searchParams).next);
  if (await loadSession()) redirect(nextPath);
  return <ForgotPasswordForm nextPath={nextPath} />;
}
