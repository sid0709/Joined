import { useCallback, useEffect, useState } from "react";

/** Client-side render window that grows by `pageSize` (load more, not pagination). */
export function useShownCount(pageSize: number, resetKey: unknown) {
  const [shownCount, setShownCount] = useState(pageSize);

  useEffect(() => {
    setShownCount(pageSize);
  }, [pageSize, resetKey]);

  const loadMore = useCallback(() => {
    setShownCount((n) => n + pageSize);
  }, [pageSize]);

  const ensureCount = useCallback((minCount: number) => {
    if (minCount <= 0) return;
    setShownCount((n) => Math.max(n, minCount));
  }, []);

  return { shownCount, loadMore, ensureCount };
}
