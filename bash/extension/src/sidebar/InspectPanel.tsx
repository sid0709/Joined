import { useRef } from "react";
import { LoadMoreFooter } from "./LoadMoreFooter";
import { useShownCount } from "./use-shown-count";

const INSPECT_PAGE = 200;

interface InspectPanelProps {
  title: string;
  lines: string[];
  hasMore: boolean;
  onLoadMore(): void;
  onCopy(): Promise<void> | void;
  onClose(): void;
}

export function InspectPanel({
  title,
  lines,
  hasMore,
  onLoadMore,
  onCopy,
  onClose,
}: InspectPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className="inspect-panel">
      <header className="inspect-header">
        <h3>{title}</h3>
        <button type="button" className="inspect-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div ref={bodyRef} className="inspect-body">
        <pre className="inspect-pre">{lines.length ? lines.join("\n") : "(empty)"}</pre>
        <LoadMoreFooter
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          rootRef={bodyRef}
          label={`Load more (${lines.length} lines)`}
        />
      </div>
      <footer className="inspect-footer">
        <button type="button" onClick={() => void onCopy()}>
          Copy
        </button>
        <button type="button" className="primary" onClick={onClose}>
          Close
        </button>
      </footer>
    </div>
  );
}

export function useInspectWindow(resetKey: unknown) {
  return useShownCount(INSPECT_PAGE, resetKey);
}
