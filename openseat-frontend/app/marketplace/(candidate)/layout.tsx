import { MarketplaceShell } from "@/src/shared/components/MarketplaceShell";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Candidate Marketplace",
};

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return <MarketplaceShell role="Candidate">{children}</MarketplaceShell>;
}
