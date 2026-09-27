import { Badge, Glyph, type BadgeVariant } from "@openseat/design-system";
import { GOOD_MATCH, STRONG_MATCH } from "@/lib/jobs";

export function matchVariant(score: number): BadgeVariant {
  if (score >= STRONG_MATCH) return "success";
  return score >= GOOD_MATCH ? "info" : "neutral";
}

export function matchProgressVariant(score: number) {
  if (score >= STRONG_MATCH) return "success" as const;
  return score >= GOOD_MATCH ? ("accent" as const) : ("neutral" as const);
}

/** "92% match", tinted by how strong the fit is. */
export function MatchBadge({ score }: { score: number }) {
  return (
    <Badge
      label={`${score}% match`}
      variant={matchVariant(score)}
      icon={score >= STRONG_MATCH ? <Glyph name="sparkle" /> : undefined}
    />
  );
}
