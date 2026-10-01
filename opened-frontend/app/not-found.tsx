import { Button, EmptyState, Stack } from "@joined/design-system";
import { AppFrame } from "@/components/shell/app-frame";
import { SeekerHeader } from "@/components/shell/seeker-header";
import { loadSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export default async function NotFound() {
  const session = await loadSession();
  // The global 404 renders outside the route groups, so it brings the public (candidate) frame.
  return (
    <AppFrame header={<SeekerHeader session={session} />}>
      <Stack gap={4}>
        <EmptyState
          title="That page is not here"
          description="The job may have closed, or the link is wrong."
          actions={<Button label="Back to jobs" variant="primary" href={ROUTES.search} />}
        />
      </Stack>
    </AppFrame>
  );
}
