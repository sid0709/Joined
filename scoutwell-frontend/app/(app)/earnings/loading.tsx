import { Grid, Skeleton, Stack } from "@joined/design-system";

const CARD = 96;
const TABLE = 280;
const KPI_MIN_WIDTH = 150;
const KPI_MAX_COLUMNS = 3;

export default function EarningsLoading() {
  return (
    <Stack gap={6}>
      <Skeleton width="40%" height={28} />
      <Grid columns={{ minWidth: KPI_MIN_WIDTH, max: KPI_MAX_COLUMNS }} gap={4}>
        <Skeleton width="100%" height={CARD} />
        <Skeleton width="100%" height={CARD} />
        <Skeleton width="100%" height={CARD} />
      </Grid>
      <Skeleton width="100%" height={TABLE} />
    </Stack>
  );
}
