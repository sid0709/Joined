import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GmailPanel } from "@/components/workspace/gmail-panel";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Gmail" };

export default async function GmailPage() {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  return <GmailPanel account={account} />;
}
