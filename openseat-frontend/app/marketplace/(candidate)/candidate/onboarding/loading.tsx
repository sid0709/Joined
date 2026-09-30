import { Card, PageBody, Skeleton, Stack } from "@/src/shared/marketplace-ui";

export default function BidderOnboardingLoading() {
  return (
    <PageBody>
      <Stack gap={24}>
        <Skeleton height={48} width="60%" />
        <Card>
          <Stack gap={12}>
            <Skeleton height={24} width="35%" />
            <Skeleton height={18} width="80%" />
            <Skeleton height={18} width="70%" />
            <Skeleton height={48} width="100%" />
          </Stack>
        </Card>
      </Stack>
    </PageBody>
  );
}
