import { Card, GridColumn, GridSystem, Skeleton, Stack } from "@openseat/design-system";

const JOB_PAGE_MAX_WIDTH = 1200;

/**
 * Shown the instant navigation starts (the URL updates right away), while the
 * job's real data streams in behind it — same shape as the loaded page.
 */
export default function Loading() {
  return (
    <Stack hAlign="center">
      <Stack gap={5} width="100%" maxWidth={JOB_PAGE_MAX_WIDTH}>
        <Skeleton width="40%" height={16} />

        <Card padding={6} elevation="low">
          <Stack gap={3}>
            <Skeleton width="50%" height={24} />
            <Skeleton width="30%" height={16} />
          </Stack>
        </Card>

        <GridSystem gap={5} responsiveTo="viewport" align="start">
          <GridColumn span="full" lg={8}>
            <Card padding={6}>
              <Stack gap={3}>
                <Skeleton width="100%" height={16} />
                <Skeleton width="100%" height={16} />
                <Skeleton width="80%" height={16} />
              </Stack>
            </Card>
          </GridColumn>
          <GridColumn span="full" lg={4}>
            <Stack gap={5}>
              <Skeleton width="100%" height={120} />
              <Skeleton width="100%" height={220} />
              <Skeleton width="100%" height={160} />
            </Stack>
          </GridColumn>
        </GridSystem>
      </Stack>
    </Stack>
  );
}
