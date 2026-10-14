import type { ReactNode } from "react";
import { Button, EmptyState } from "sid-ui";
import {
  LOAD_ERROR_FALLBACK,
  LOAD_ERROR_TITLE,
  LOAD_RETRY_LABEL,
  type AsyncStatus,
} from "@/lib/async-state";

/** A failed request: say so plainly and offer a retry. */
export function LoadError({
  title = LOAD_ERROR_TITLE,
  message,
  onRetry,
}: {
  title?: string;
  message?: string | null;
  onRetry: () => void;
}) {
  return (
    <div role="alert">
      <EmptyState
        title={title}
        description={message || LOAD_ERROR_FALLBACK}
        actions={<Button label={LOAD_RETRY_LABEL} variant="secondary" onClick={onRetry} />}
      />
    </div>
  );
}

/**
 * The one loading / empty / error / loaded pattern. Pass a `loading` skeleton shaped
 * like the content so the swap does not shift the layout.
 */
export function AsyncState({
  status,
  loading,
  empty,
  error,
  errorTitle,
  onRetry,
  children,
}: {
  status: AsyncStatus;
  loading: ReactNode;
  empty: ReactNode;
  error?: string | null;
  errorTitle?: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (status === "loading") {
    return (
      <div role="status" aria-busy="true" aria-label="Loading">
        {loading}
      </div>
    );
  }
  if (status === "error") return <LoadError title={errorTitle} message={error} onRetry={onRetry} />;
  if (status === "empty") return <>{empty}</>;
  return <>{children}</>;
}
