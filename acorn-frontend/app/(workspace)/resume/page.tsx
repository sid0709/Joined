import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResumePanel } from "@/components/workspace/resume-panel";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Resume" };

export default async function ResumePage() {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  return <ResumePanel account={account} />;
}
