import { Badge, Button, Card, HStack, Text, VStack } from "sid-ui";
import type { TabTreeSummary } from "./tab-tree-cache";
import type { InspectKind } from "./use-tab-ui";

type AnalyzedTreeSectionProps = {
  lastFetch: TabTreeSummary;
  nodeCount: number;
  hasTree: boolean;
  hasPlan: boolean;
  onInspect: (kind: InspectKind, title: string) => void;
};

/** The active tab's last analyzed page, with buttons that open each inspector view. */
export function AnalyzedTreeSection({
  lastFetch,
  nodeCount,
  hasTree,
  hasPlan,
  onInspect,
}: AnalyzedTreeSectionProps) {
  return (
    <Card padding={3}>
      <VStack gap={2}>
        <Text as="h3" weight="semibold">
          Analyzed tree
        </Text>
        <VStack gap={0}>
          <Text weight="semibold" maxLines={1}>
            {String(lastFetch.title ?? "Untitled")}
          </Text>
          <Text type="supporting" maxLines={1}>
            {String(lastFetch.url ?? "")}
          </Text>
        </VStack>
        <HStack gap={2}>
          <Badge variant="neutral" label={`${nodeCount} nodes`} />
          <Text type="supporting">{new Date(lastFetch.fetchedAt).toLocaleTimeString()}</Text>
        </HStack>
        <HStack gap={1} wrap="wrap">
          <Button
            variant="secondary"
            size="sm"
            label="Pure Tree"
            isDisabled={!hasTree}
            onClick={() => onInspect("pure", "Pure Tree")}
          />
          <Button
            variant="secondary"
            size="sm"
            label="Meta Tree"
            isDisabled={!hasTree}
            onClick={() => onInspect("meta", "Meta Tree")}
          />
          <Button
            variant="secondary"
            size="sm"
            label={hasPlan ? "AI Analyze" : "AI Analyze (pending)"}
            isDisabled={!hasPlan}
            onClick={() => onInspect("plan", "AI Analyze")}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
