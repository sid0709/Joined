import { useEffect, useRef } from "react";
import { Button } from "sid-ui";

type LoadMoreFooterProps = {
  hasMore: boolean;
  onLoadMore: () => void;
  label: string;
  /** Scroll container; omit to use the viewport. */
  rootRef?: { readonly current: Element | null };
};

/** Sentinel + button. IntersectionObserver loads the next chunk when the footer is near view. */
export function LoadMoreFooter({ hasMore, onLoadMore, label, rootRef }: LoadMoreFooterProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { root: rootRef?.current ?? null, rootMargin: "80px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, rootRef, label]);

  if (!hasMore) return null;

  return (
    <div ref={sentinelRef} className="load-more-footer">
      <Button variant="ghost" size="sm" label={label} width="100%" onClick={onLoadMore} />
    </div>
  );
}
