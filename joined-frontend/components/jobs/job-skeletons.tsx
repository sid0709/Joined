import { Card, HStack, Skeleton, Stack } from "sid-ui";

const RESULT_SKELETON_COUNT = 5;
const LOGO_SIZE = 48;
const DETAIL_BODY_LINES = 4;

/** Placeholder cards the size of a result card, so a page change does not jump. */
export function JobResultsSkeleton() {
  return (
    <Stack gap={3}>
      {Array.from({ length: RESULT_SKELETON_COUNT }, (_, index) => (
        <Card key={index} padding={4}>
          <HStack gap={3} vAlign="start">
            <Skeleton width={LOGO_SIZE} height={LOGO_SIZE} index={index} />
            <Stack gap={2} width="100%">
              <Skeleton width="60%" height={20} index={index} />
              <Skeleton width="40%" height={14} index={index} />
              <Skeleton width="30%" height={14} index={index} />
              <Skeleton width="50%" height={14} index={index} />
            </Stack>
          </HStack>
        </Card>
      ))}
    </Stack>
  );
}

/** Stands in for everything under a job's header while its details load. */
export function JobDetailBodySkeleton() {
  return (
    <Stack gap={6}>
      <Stack gap={3}>
        <Skeleton width="30%" height={20} />
        {Array.from({ length: DETAIL_BODY_LINES }, (_, index) => (
          <Skeleton
            key={index}
            width={index === DETAIL_BODY_LINES - 1 ? "70%" : "100%"}
            height={16}
            index={index}
          />
        ))}
      </Stack>
      <Skeleton width="100%" height={160} />
    </Stack>
  );
}
