import type { Metadata } from "next";

import { MarketplaceShell } from "@/src/shared/components/MarketplaceShell";

export const metadata: Metadata = {
  title: "Bidder Marketplace",
};

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return <MarketplaceShell role="Candidate">{children}</MarketplaceShell>;
}
