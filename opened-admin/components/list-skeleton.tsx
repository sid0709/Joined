import { Skeleton, Stack } from "@openseat/design-system";

const TITLE_HEIGHT = 32;
const TABLE_HEIGHT = 420;

/** Placeholder while a client list page reads its search params. */
export function ListSkeleton() {
  return (
    <Stack gap={4}>
      <Skeleton width="30%" height={TITLE_HEIGHT} />
      <Skeleton width="100%" height={TABLE_HEIGHT} />
    </Stack>
  );
}
