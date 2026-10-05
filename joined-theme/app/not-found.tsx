import { BrandLockup, Button, EmptyState, Stack } from "sid-ui";

export default function NotFound() {
  return (
    <Stack gap={4} hAlign="center">
      <BrandLockup />
      <EmptyState
        title="Not found"
        description="That component isn’t in the library."
        actions={<Button label="Back to library" href="/" variant="secondary" />}
      />
    </Stack>
  );
}
