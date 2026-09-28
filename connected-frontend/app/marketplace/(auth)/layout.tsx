import { MarketplaceAuthShell } from "@/src/shared/components/MarketplaceAuthShell";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <MarketplaceAuthShell>{children}</MarketplaceAuthShell>;
}
