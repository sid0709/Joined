"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { useIsMounted } from "@/src/shared/hooks/useIsMounted";
import { Button, Card, Stack } from "@/src/shared/marketplace-ui";

export default function MarketplaceJoinPage() {
  const router = useRouter();
  const { currentUser, assignRole } = useMockAuth();
  const isMounted = useIsMounted();

  const handleRoleSelection = (role: "Candidate" | "Client") => {
    assignRole(role);
    router.push(
      role === "Candidate" ? "/marketplace/candidate/profile" : "/marketplace/client/dashboard",
    );
  };

  const greeting =
    isMounted && currentUser?.fullName ? `Welcome, ${currentUser.fullName}` : "Welcome";

  return (
    <Card className="marketplace-auth-card marketplace-join-card">
      <Stack gap={24}>
        <div className="marketplace-centered-copy">
          <h1 className="h1">{greeting}</h1>
          <p className="body text-ink-muted">How would you like to use OpenSeat?</p>
        </div>
        <div className="marketplace-role-grid">
          <Button
            type="button"
            variant="secondary"
            label="Join as a candidate"
            className="marketplace-role-button"
            onClick={() => handleRoleSelection("Candidate")}
          >
            <strong>I’m a candidate</strong>
            <span>Browse projects, place bids, and manage delivery.</span>
            <span className="marketplace-role-cta" aria-hidden="true">
              Continue <span>→</span>
            </span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            label="Join as a client"
            className="marketplace-role-button"
            onClick={() => handleRoleSelection("Client")}
          >
            <strong>I’m a client</strong>
            <span>Post a brief, compare applicants, and manage delivery.</span>
            <span className="marketplace-role-cta" aria-hidden="true">
              Continue <span>→</span>
            </span>
          </Button>
        </div>
        <Link className="marketplace-back-link os-link" href="/marketplace/login">
          ← Back to sign in
        </Link>
      </Stack>
    </Card>
  );
}
