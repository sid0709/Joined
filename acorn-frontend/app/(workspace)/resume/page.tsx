import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResumeGenerator } from "@/components/workspace/resume/resume-generator";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Generate resume" };

export default async function ResumePage() {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  return <ResumeGenerator account={account} />;
}
