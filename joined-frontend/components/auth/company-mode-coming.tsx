"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Heading, Stack, Text } from "sid-ui";
import { ROUTES } from "@/lib/routes";

export function CompanyModeComing() {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    clearApplicationExtras();
    router.push(ROUTES.search);
    router.refresh();
  };

  return (
    <Card padding={6} maxWidth="500px">
      <Stack gap={4}>
        <Heading level={2}>Company accounts coming soon</Heading>
        <Text color="secondary">
          Company and recruiter features are not yet available. Sign out and create a candidate
          account to search and apply for jobs.
        </Text>
        <Button label="Sign out" variant="primary" onClick={() => void signOut()} />
      </Stack>
    </Card>
  );
}
