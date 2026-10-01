import { Skeleton, Stack } from "@joined/design-system";

const SEARCH_HEIGHT = 72;
const LIST_HEIGHT = 360;

export default function Loading() {
  return (
    <Stack gap={4}>
      <Skeleton width="36%" height={28} />
      <Skeleton width="100%" height={SEARCH_HEIGHT} />
      <Skeleton width="100%" height={LIST_HEIGHT} />
    </Stack>
  );
}
