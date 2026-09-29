import type { Metadata } from "next";
import { Banner, Button, EmptyState, Stack, Text } from "@openseat/design-system";
import { AppFrame } from "@/components/shell/app-frame";
import { SeekerHeader } from "@/components/shell/seeker-header";
import { loadSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Pick an interview time",
  description: "Choose a time that works for your interview.",
};

/**
 * Public candidate self-schedule landing.
 * Einstein mints `{FRONTEND_ORIGIN}/schedule/{interviewId}` on awaiting self-schedule
 * rounds. Candidate accept/lock API is not built yet — this page is a placeholder.
 */
export default async function PublicSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();

  return (
    <AppFrame header={<SeekerHeader session={session} />}>
      <Stack gap={6}>
        <EmptyState
          title="Pick a time for your interview"
          description="This self-schedule link is ready on the employer side. Candidate accept is not live yet — the hiring team can still lock a slot from Interviews."
          actions={<Button label="Browse jobs" variant="primary" href={ROUTES.search} />}
        />
        <Banner
          status="info"
          title="Coming soon"
          description={`Interview ${id} — when the accept API lands, you will confirm one of the offered times here.`}
        />
        <Text type="supporting" color="secondary">
          If you already have an Opened account, sign in and check Interviews for updates from the
          company.
        </Text>
      </Stack>
    </AppFrame>
  );
}
