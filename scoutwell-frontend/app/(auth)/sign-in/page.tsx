import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNextPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = safeNextPath((await searchParams).next);
  return <SignInForm nextPath={nextPath} />;
}
