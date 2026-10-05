import type { Metadata } from "next";
import { VerifyEmailCard } from "@/components/auth/verify-email-card";
import { AUTH_TOKEN_PARAM } from "@/lib/auth/email";
import { verifyEmailToken } from "@/lib/auth/email-api";
import { joinedApiUrl } from "@/lib/config";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ [AUTH_TOKEN_PARAM]?: string }>;
}) {
  const token = (await searchParams)[AUTH_TOKEN_PARAM] ?? "";
  const result = await verifyEmailToken(joinedApiUrl(), token);
  return <VerifyEmailCard ok={result.ok} message={result.message} />;
}
