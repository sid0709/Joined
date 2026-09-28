import type { ReactNode } from "react";
import { Text } from "@openseat/design-system";

/**
 * A ListItem description that wraps. A plain-string description is clamped to one
 * line; a node is not.
 */
export function FullText({ children }: { children: ReactNode }) {
  return (
    <Text type="supporting" color="secondary" display="block">
      {children}
    </Text>
  );
}
