import { ReactNode } from "react";

import { BrandFooter, BrandLockup, ThemeToggle } from "@/src/shared/marketplace-ui";

export function MarketplaceAuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="marketplace-auth-shell">
      <div className="marketplace-theme-toggle">
        <ThemeToggle />
      </div>
      <BrandLockup tagline="The work marketplace — clear briefs, thoughtful bids." />
      {children}
      <BrandFooter lead="©" />
    </main>
  );
}
