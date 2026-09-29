import type { Metadata } from "next";
import { Banner, Button, EmptyState, Stack, Text } from "@openseat/design-system";
import { AppFrame } from "@/components/shell/app-frame";
import { SeekerHeader } from "@/components/shell/seeker-header";
import { PublicSchedulePicker } from "@/components/schedule/public-schedule-picker";
import { loadSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { loadPublicSchedule } from "@/lib/schedule-public";

export const metadata: Metadata = {
  title: "Pick an interview time",
  description: "Choose a time that works for your interview.",
};

/**
 * Public candidate self-schedule landing.
 * The API mints `{FRONTEND_ORIGIN}/schedule/{selfScheduleToken}` and still
 * accepts a legacy interview id at GET/POST /v1/schedule/:key(/accept).
 */
export default async function PublicSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  const loaded = await loadPublicSchedule(id);

  if (!loaded.ok) {
    const expired = loaded.status === 410;
    const missing = loaded.status === 404;
    return (
      <AppFrame header={<SeekerHeader session={session} />}>
        <Stack gap={6}>
          <EmptyState
            title={expired ? "This link has expired" : "Schedule link not found"}
            description={
              expired
                ? "Ask the hiring team to send a new self-schedule link."
                : "This self-schedule link is invalid or no longer available."
            }
            actions={<Button label="Browse jobs" variant="primary" href={ROUTES.search} />}
          />
          <Banner
            status={expired ? "warning" : "info"}
            title={expired ? "Expired" : missing ? "Not found" : "Could not load"}
            description={loaded.message}
          />
          <Text type="supporting" color="secondary">
            If you already have an Opened account, sign in and check Interviews for updates from the
            company.
          </Text>
        </Stack>
      </AppFrame>
    );
  }

  return (
    <AppFrame header={<SeekerHeader session={session} />}>
      <PublicSchedulePicker scheduleKey={id} initial={loaded.schedule} />
    </AppFrame>
  );
}
