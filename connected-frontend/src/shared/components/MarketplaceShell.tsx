"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { useIsMounted } from "@/src/shared/hooks/useIsMounted";
import { AppShell, NavItem } from "@/src/shared/marketplace-ui";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

type MarketplaceRole = "Candidate" | "Client";

const NAV_ITEMS: Record<MarketplaceRole, { label: string; href: string; also?: string[] }[]> = {
  Candidate: [
    { label: "Dashboard", href: BIDDER_ROUTES.dashboard },
    { label: "Task Board", href: BIDDER_ROUTES.board },
    {
      label: "Pipeline",
      href: BIDDER_ROUTES.pipeline,
      also: [BIDDER_ROUTES.invitations, BIDDER_ROUTES.interviews],
    },
    { label: "Messages", href: BIDDER_ROUTES.messages },
    { label: "My Work", href: BIDDER_ROUTES.work },
    { label: "Reviews", href: BIDDER_ROUTES.reviews },
    {
      label: "Earnings",
      href: BIDDER_ROUTES.earnings,
      also: [BIDDER_ROUTES.performance],
    },
    {
      label: "Profile",
      href: BIDDER_ROUTES.profile,
      also: [BIDDER_ROUTES.assessments, BIDDER_ROUTES.notifications],
    },
  ],
  Client: [
    { label: "Add Job Link", href: "/marketplace/client/jobs/new" },
    { label: "Job Pool", href: "/marketplace/client/jobs" },
    { label: "Bidders", href: "/marketplace/client/bidders" },
    { label: "Interview Calendar", href: "/marketplace/client/calendar" },
    { label: "Applications", href: "/marketplace/client/applications" },
    { label: "Managed Bidders", href: "/marketplace/client/work" },
    { label: "Payments", href: "/marketplace/client/payments" },
    { label: "Profile", href: "/marketplace/client/profile" },
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
        currentUser.role === "Candidate"
          ? "/marketplace/candidate/dashboard"
          : "/marketplace/client/dashboard",
      );
    }
  }, [currentUser, isMounted, role, router]);

  return <>{children}</>;
}

export function MarketplaceShell({
  role,
  children,
}: {
  role: MarketplaceRole;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { currentUser, logoutUser } = useMockAuth();
  const items: NavItem[] = NAV_ITEMS[role].map(({ also = [], ...item }) => ({
    ...item,
    active:
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`) ||
      also.some((extra) => pathname === extra),
  }));

  return (
    <RoleGuard role={role}>
      <AppShell
        nav={{
          brand: role === "Candidate" ? "OpenSeat Bidder" : "OpenSeat Marketplace",
          items,
          cta: "Log Out",
          onCtaClick: logoutUser,
          initials: initialsFor(currentUser?.fullName),
          userHref:
            role === "Candidate" ? "/marketplace/candidate/profile" : "/marketplace/client/profile",
          showAvatar: true,
          showThemeToggle: true,
        }}
      >
        {children}
      </AppShell>
    </RoleGuard>
  );
}
