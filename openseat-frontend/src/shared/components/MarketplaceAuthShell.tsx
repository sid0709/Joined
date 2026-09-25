import { ReactNode } from "react";
import { ThemeToggle } from "@openseat/design-system";

export function MarketplaceAuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="marketplace-auth-shell">
      <div className="marketplace-theme-toggle">
        <ThemeToggle />
      </div>
      {children}
    </main>
  );
}
