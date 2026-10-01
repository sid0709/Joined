import {
  Badge,
  CheckboxInput,
  HStack,
  List,
  ListItem,
  Spinner,
  Stack,
  Text,
  SectionCard,
} from "@joined/design-system";

import type { MatchesState } from "./use-matches";
import type { JobMatch } from "@joined/scout";

import { FullText } from "@/components/full-text";

function kindLabel(kind: JobMatch["kind"]) {
  return kind === "link" ? "Same apply link" : "Same company and title";
}

/** Existing jobs that share this link or company and title. */
export function MatchesCard({
  state,
  claimed,
  onClaim,
}: {
  state: MatchesState;
  claimed: boolean;
  onClaim: (value: boolean) => void;
}) {
  const matches = state.phase === "done" ? state.matches : [];
  return (
    <SectionCard
      title="Possible matches"
      description="Shown when an existing job uses this apply link or the same company and title. Submit is not blocked."
    >
      {state.phase === "idle" ? (
        <Text color="secondary" display="block">
          Add the apply link, company, and title to check the pool.
        </Text>
      ) : null}
      {state.phase === "checking" ? (
        <HStack gap={2} vAlign="center">
          <Spinner size="sm" />
          <Text color="secondary">Looking for existing jobs…</Text>
        </HStack>
      ) : null}
      {state.phase === "invalid" ? (
        <Text color="secondary" display="block">
          {state.message}
        </Text>
      ) : null}
      {state.phase === "done" && matches.length === 0 ? (
        <Text color="secondary" display="block">
          No existing job shares this link or this company and title.
        </Text>
      ) : null}
      {matches.length > 0 ? (
        <Stack gap={4}>
          <List density="compact">
            {matches.map((match) => (
              <ListItem
                key={`${match.kind}-${match.job_id ?? match.submission_id ?? match.apply_link}`}
                label={match.title}
                description={
                  <FullText>
                    {match.company}
                    {match.apply_link ? ` · ${match.apply_link}` : ""}
                  </FullText>
                }
                startContent={<Badge label={kindLabel(match.kind)} variant="warning" />}
              />
            ))}
          </List>
          <CheckboxInput
            label="This is not the same job"
            description="Staff will review your claim before it enters the pool."
            value={claimed}
            onChange={onClaim}
          />
        </Stack>
      ) : null}
    </SectionCard>
  );
}
