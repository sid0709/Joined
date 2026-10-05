import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfilePanel } from "@/components/workspace/profile-panel";
import { currentAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const account = await currentAccount();
  if (!account) redirect(ROUTES.signIn);
  return <ProfilePanel account={account} />;
}
