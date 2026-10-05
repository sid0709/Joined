import { HStack, ProgressBar, Stack, Text, Token } from "sid-ui";
import type { KeywordMatch } from "@/lib/workspace/keywords";

const STRONG = 70;
const FAIR = 40;

/** How much of the posting the profile already covers, word by word. */
export function MatchAnalysis({ match }: { match: KeywordMatch }) {
  const total = match.matched.length + match.missing.length;
  if (total === 0) {
    return (
      <Text type="supporting" color="secondary">
        Paste a job description to see which of its words your profile already covers.
      </Text>
    );
  }
  const verdict =
    match.score >= STRONG ? "Strong match" : match.score >= FAIR ? "Partial match" : "Weak match";
  return (
    <Stack gap={4}>
      <ProgressBar
        label={verdict}
        value={match.score}
        hasValueLabel
        variant={match.score >= STRONG ? "success" : match.score >= FAIR ? "accent" : "warning"}
      />
      <Stack gap={2}>
        <Text type="supporting" color="secondary">
          {`Covered · ${match.matched.length}`}
        </Text>
        <HStack gap={1} wrap="wrap">
          {match.matched.map((word) => (
            <Token key={word} label={word} color="green" size="sm" />
          ))}
        </HStack>
      </Stack>
      {match.missing.length > 0 ? (
        <Stack gap={2}>
          <Text type="supporting" color="secondary">
            {`Not in your profile · ${match.missing.length} — the draft leans on these`}
          </Text>
          <HStack gap={1} wrap="wrap">
            {match.missing.map((word) => (
              <Token key={word} label={word} color="orange" size="sm" />
            ))}
          </HStack>
        </Stack>
      ) : null}
    </Stack>
  );
}
