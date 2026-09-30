import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { loadSession, safeNextPath } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; intent?: string }>;
}) {
  const params = await searchParams;
  const hiring = params.intent === "hiring";
  const session = await loadSession();
  if (session && hiring) {
    if (session.company) redirect(ROUTES.company);
    if (session.user.role === "employee") redirect(ROUTES.hiringSetup);
    redirect(ROUTES.search);
  }
  if (session) redirect(safeNextPath(params.next));
  return <SignUpForm nextPath={safeNextPath(params.next)} hiring={hiring} />;
}
