"use client";

import { Banner, EmptyState, Skeleton, Stack } from "sid-ui";

const TABLE_HEIGHT = 280;

/** Shared loading, missing-endpoint, and empty copy for trust queues. */
export function TrustState({
  loading,
  error,
  empty,
  emptyTitle,
  emptyDescription,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) return <Skeleton width="100%" height={TABLE_HEIGHT} />;
  return (
    <Stack gap={4}>
      {error ? <Banner status="error" title={error} /> : null}
      {empty && !error ? (
        <EmptyState isCompact title={emptyTitle} description={emptyDescription} />
      ) : null}
    </Stack>
  );
}
