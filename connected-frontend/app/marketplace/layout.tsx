import { MarketplaceProviders } from "./providers";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Marketplace | Joined",
    template: "%s | Joined",
  },
  description: "Browse job rooms, place bids, and manage delivery in Joined.",
};

export default function MarketplaceRootLayout({ children }: { children: ReactNode }) {
  return <MarketplaceProviders>{children}</MarketplaceProviders>;
}
