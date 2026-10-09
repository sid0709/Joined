import { Skeleton, Stack } from "sid-ui";

const TITLE_HEIGHT = 28;
const BLOCK_HEIGHT = 240;

export default function Loading() {
  return (
    <Stack gap={4}>
      <Skeleton width="36%" height={TITLE_HEIGHT} />
      <Skeleton width="100%" height={BLOCK_HEIGHT} />
    </Stack>
  );
}
