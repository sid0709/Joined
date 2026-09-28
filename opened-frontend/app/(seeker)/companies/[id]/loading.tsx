import {
  Card,
  GridColumn,
  GridSystem,
  HStack,
  Section,
  Skeleton,
  Stack,
} from "@openseat/design-system";
import { PageContainer } from "@/components/page-container";

const LOGO_SIZE = 96;
const STAT_WIDTH = 72;

function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <Card padding={6}>
      <Stack gap={4}>
        <Skeleton width="40%" height={20} />
        <Stack gap={2}>
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton key={index} height={14} width={index === lines - 1 ? "70%" : "100%"} />
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}

/**
 * Shown the instant navigation starts (the URL updates right away), while the
 * company's real data streams in behind it — same shape as the loaded page.
 */
export default function Loading() {
  return (
    <PageContainer>
      <Stack gap={6}>
        <Card padding={0} elevation="low">
          <Section variant="muted" dividers={["bottom"]} padding={8}>
            <HStack gap={5} vAlign="center">
              <Skeleton width={LOGO_SIZE} height={LOGO_SIZE} radius="rounded" />
              <Stack gap={2}>
                <Skeleton width={220} height={28} />
                <Skeleton width={180} height={16} />
                <Skeleton width={260} height={16} />
              </Stack>
            </HStack>
          </Section>
          <HStack gap={6} padding={5} paddingInline={8} wrap="wrap">
            {Array.from({ length: 4 }, (_, index) => (
              <Stack gap={1} key={index}>
                <Skeleton width={STAT_WIDTH} height={12} />
                <Skeleton width={STAT_WIDTH} height={18} />
              </Stack>
            ))}
          </HStack>
        </Card>

        <GridSystem gap={6} align="start">
          <GridColumn span="full" lg={8}>
            <Stack gap={6}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={4} />
            </Stack>
          </GridColumn>
          <GridColumn span="full" lg={4}>
            <Stack gap={6}>
              <SkeletonCard lines={3} />
              <SkeletonCard lines={1} />
              <SkeletonCard lines={2} />
            </Stack>
          </GridColumn>
        </GridSystem>
      </Stack>
    </PageContainer>
  );
}
