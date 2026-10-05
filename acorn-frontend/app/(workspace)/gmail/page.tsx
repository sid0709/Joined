import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GmailPanel } from "@/components/workspace/gmail-panel";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { loadActivity } from "@/lib/workspace/activity";
import { mailFromApplications } from "@/lib/workspace/mail";

export const metadata: Metadata = { title: "Gmail" };

export default async function GmailPage() {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  const { today, applications } = loadActivity();
  return (
    <GmailPanel account={account} mail={mailFromApplications(applications, today)} today={today} />
  );
}
