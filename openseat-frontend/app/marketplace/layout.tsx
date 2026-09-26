import type { ReactNode } from "react";
import type { Metadata } from "next";
import { MarketplaceProviders } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Marketplace | OpenSeat",
    template: "%s | OpenSeat",
  },
  description: "Browse job rooms, place bids, and manage delivery in OpenSeat.",
};

export default function MarketplaceRootLayout({ children }: { children: ReactNode }) {
  return <MarketplaceProviders>{children}</MarketplaceProviders>;
}
