import type { Metadata } from "next";
import { MarketplaceShell } from "@/src/shared/components/MarketplaceShell";

export const metadata: Metadata = {
  title: "Client Workspace",
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <MarketplaceShell role="Client">{children}</MarketplaceShell>;
}
