import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AUTH_TOKEN_PARAM } from "@/lib/auth/email";
import { safeNextPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [AUTH_TOKEN_PARAM]?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <ResetPasswordForm
      token={params[AUTH_TOKEN_PARAM] ?? ""}
      nextPath={safeNextPath(params.next)}
    />
  );
}
