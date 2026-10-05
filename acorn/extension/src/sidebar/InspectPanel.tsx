import { Button, Drawer, HStack } from "sid-ui";
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
  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      size="full"
      footer={
        <HStack gap={2} justify="end">
          <Button variant="secondary" label="Copy" onClick={() => void onCopy()} />
          <Button variant="primary" label="Close" onClick={onClose} />
        </HStack>
      }
    >
      <pre className="inspect-pre">{lines.length ? lines.join("\n") : "(empty)"}</pre>
      <LoadMoreFooter
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        label={`Load more (${lines.length} lines)`}
      />
    </Drawer>
  );
}

export function useInspectWindow(resetKey: unknown) {
  return useShownCount(INSPECT_PAGE, resetKey);
}
