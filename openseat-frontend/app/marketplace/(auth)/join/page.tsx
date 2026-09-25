"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Grid, Stack } from "@openseat/design-system";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { useIsMounted } from "@/src/shared/hooks/useIsMounted";

export default function MarketplaceJoinPage() {
  const router = useRouter();
  const { currentUser, assignRole } = useMockAuth();
  const isMounted = useIsMounted();

  const handleRoleSelection = (role: "Candidate" | "Client") => {
    assignRole(role);
    router.push(role === "Candidate" ? "/marketplace/candidate/profile" : "/marketplace/client/dashboard");
  };

  const greeting = isMounted && currentUser?.fullName ? `Welcome, ${currentUser.fullName}` : "Welcome";

  return (
    <Card className="marketplace-auth-card marketplace-join-card">
      <Stack gap={24}>
        <div className="marketplace-centered-copy">
          <h1 className="h1">{greeting}</h1>
          <p className="body text-ink-muted">Choose how you would like to participate in the OpenSeat marketplace.</p>
        </div>
        <Grid columns={2} gap={16}>
          <Button type="button" variant="secondary" className="marketplace-role-button" onClick={() => handleRoleSelection("Candidate")}>
            <strong>Join as a candidate</strong>
            <span>Find relevant work, place bids, and manage delivery.</span>
          </Button>
          <Button type="button" variant="secondary" className="marketplace-role-button" onClick={() => handleRoleSelection("Client")}>
            <strong>Join as a client</strong>
            <span>Post a brief, compare applicants, and manage delivery.</span>
          </Button>
        </Grid>
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/marketplace/login")}>
          Back to sign in
        </Button>
      </Stack>
    </Card>
  );
}
