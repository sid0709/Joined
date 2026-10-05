import type { Metadata } from "next";
import { CheckEmailCard } from "@/components/auth/check-email-card";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const email = (await searchParams).email?.trim() ?? "";
  return <CheckEmailCard email={email} />;
}
