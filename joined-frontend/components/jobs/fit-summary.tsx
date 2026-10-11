import { HStack, Link, Stack, Text } from "sid-ui";
import { criterionLabel, hasFitScore, type JobFit } from "@/lib/jobs/fit";
import { ROUTES } from "@/lib/routes";
import { MatchBadge } from "./match-badge";

/**
 * How well one job fits, above its details. Before the profile has anything to
 * score against, it asks for that instead of showing a 0% match.
 */
export function FitSummary({ fit }: { fit: JobFit }) {
  if (!hasFitScore(fit)) {
    return (
      <Stack gap={1}>
        {fit.reason ? (
          <Text color="secondary" display="block">
            {fit.reason}
          </Text>
        ) : null}
        <HStack>
          <Link href={ROUTES.profile}>Complete your profile</Link>
        </HStack>
      </Stack>
    );
  }
  return (
    <Stack gap={2}>
      <HStack>
        <MatchBadge score={fit.score} />
      </HStack>
      {fit.reason ? (
        <Text color="secondary" display="block">
          {fit.reason}
        </Text>
      ) : null}
      <Text type="supporting" color="secondary" display="block">
        {fit.criteria.map((item) => criterionLabel(item)).join(" · ")}
      </Text>
    </Stack>
  );
}
