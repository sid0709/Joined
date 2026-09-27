import { Button, EmptyState, Stack } from "@openseat/design-system";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <Stack gap={4}>
      <EmptyState
        title="That page is not here"
        description="The job may have closed, or the link is wrong."
        actions={<Button label="Back to jobs" variant="primary" href={ROUTES.search} />}
      />
    </Stack>
  );
}
