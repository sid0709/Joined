import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverviewPanel } from "@/components/workspace/overview-panel";
import { currentAccount } from "@/lib/auth/session";
import { loadActivity } from "@/lib/workspace/activity";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Statistics" };

export default async function OverviewPage() {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  return <OverviewPanel account={account} activity={loadActivity()} />;
}
