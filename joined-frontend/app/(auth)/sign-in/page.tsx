import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GOOGLE_ERROR_PARAM, googleErrorMessage } from "@joined/google-signin";
import { SignInForm } from "@/components/auth/sign-in-form";
import { loadSession, safeNextPath } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; [GOOGLE_ERROR_PARAM]?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  if (await loadSession()) redirect(nextPath);
  return (
    <SignInForm nextPath={nextPath} googleError={googleErrorMessage(params[GOOGLE_ERROR_PARAM])} />
  );
}
