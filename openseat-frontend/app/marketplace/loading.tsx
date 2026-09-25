import { PageBody, Skeleton, Stack } from "@openseat/design-system";

export default function MarketplaceLoading() {
  return (
    <PageBody>
      <Stack gap={16}>
        <Skeleton width="45%" height={28} />
        <Skeleton width="70%" height={16} />
        <Skeleton height={180} />
      </Stack>
    </PageBody>
  );
}
