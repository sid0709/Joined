"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, NavItem } from "@/src/shared/marketplace-ui";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { useIsMounted } from "@/src/shared/hooks/useIsMounted";

type MarketplaceRole = "Candidate" | "Client";

const NAV_ITEMS: Record<MarketplaceRole, { label: string; href: string }[]> = {
  Candidate: [
    { label: "Find Work", href: "/marketplace/jobs" },
    { label: "My Bids", href: "/marketplace/candidate/bids" },
    { label: "Active Work", href: "/marketplace/candidate/work" },
    { label: "Messages", href: "/marketplace/messages" },
    { label: "Profile", href: "/marketplace/candidate/profile" },
  ],
  Client: [
    { label: "Post Job", href: "/marketplace/client/jobs/new" },
    { label: "Jobs", href: "/marketplace/client/jobs" },
    { label: "Applications", href: "/marketplace/client/applications" },
    { label: "Managed Work", href: "/marketplace/client/work" },
  ],
};

function initialsFor(name?: string) {
  return (name ?? "OpenSeat")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function RoleGuard({ role, children }: { role: MarketplaceRole; children: ReactNode }) {
  const router = useRouter();
  const { currentUser } = useMockAuth();
  const isMounted = useIsMounted();

  useEffect(() => {
    if (!isMounted) return;
    if (!currentUser) {
      router.replace("/marketplace/login");
      return;
    }
    if (!currentUser.role) {
      router.replace("/marketplace/join");
      return;
    }
    if (currentUser.role !== role) {
      router.replace(
        currentUser.role === "Candidate" ? "/marketplace/candidate/dashboard" : "/marketplace/client/dashboard"
      );
    }
  }, [currentUser, isMounted, role, router]);

  return <>{children}</>;
}

export function MarketplaceShell({ role, children }: { role: MarketplaceRole; children: ReactNode }) {
  const pathname = usePathname();
  const { currentUser, logoutUser } = useMockAuth();
  const items: NavItem[] = NAV_ITEMS[role].map((item) => ({
    ...item,
    active: pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));

  return (
    <RoleGuard role={role}>
      <AppShell
        nav={{
          brand: "OpenSeat Marketplace",
          items,
          cta: "Log Out",
          onCtaClick: logoutUser,
          initials: initialsFor(currentUser?.fullName),
          showAvatar: true,
          showThemeToggle: true,
        }}
      >
        {children}
      </AppShell>
    </RoleGuard>
  );
}
