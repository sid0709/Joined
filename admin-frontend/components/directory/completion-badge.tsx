import { Badge } from "@joined/design-system";
import { completionTier } from "@/lib/directory";

/** How complete a company page or job is, colored by tier. */
export function CompletionBadge({ completion }: { completion: number }) {
  return <Badge label={`${completion}%`} variant={completionTier(completion)} />;
}
