import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { loadSession } from "@/lib/auth/session";
import { param, type SearchParams } from "@/lib/page";
import { safeNextPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const destination = safeNextPath(param((await searchParams).next));
  if (await loadSession()) redirect(destination);
  return <SignInForm nextPath={destination} />;
}
