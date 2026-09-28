import { Skeleton, Stack } from "@openseat/design-system";

const HERO = 72;
const BODY = 280;

export default function Loading() {
  return (
    <Stack gap={4}>
      <Skeleton width="40%" height={28} />
      <Skeleton width="100%" height={HERO} />
      <Skeleton width="100%" height={BODY} />
    </Stack>
  );
}
