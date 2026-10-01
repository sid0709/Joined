import { Button, EmptyState } from "@joined/design-system";

export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      description="That component isn’t in the library."
      actions={<Button label="Back to library" href="/" variant="secondary" />}
    />
  );
}
