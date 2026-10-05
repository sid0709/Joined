import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResumeHistory } from "@/components/workspace/resume/resume-history";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Resume history" };

export default async function ResumeHistoryPage() {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  return <ResumeHistory account={account} />;
}
