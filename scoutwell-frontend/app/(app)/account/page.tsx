import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account/account-workspace";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return <AccountWorkspace />;
}
