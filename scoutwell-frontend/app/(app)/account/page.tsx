import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountView } from "@/components/account/account-view";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadStats } from "@/lib/scout/load";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const stats = await loadStats();
  if (!stats) redirect(signInHref(ROUTES.account));
  return <AccountView profile={stats.profile} levelLabel={stats.level.label} />;
}
