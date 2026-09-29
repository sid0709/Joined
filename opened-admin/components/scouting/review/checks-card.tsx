import { Badge, HStack, SectionCard, Stack, Text } from "@openseat/design-system";
import { CHECK_OUTCOME, isPending, type Submission } from "@openseat/scout";
import { formatDateTime } from "@/lib/format";

/** The automatic check results, in the order they ran. */
export function ChecksCard({ submission }: { submission: Submission }) {
  const checks = submission.auto_check_results;
  return (
    <SectionCard
      title="Automatic checks"
      description={
        submission.checked_at
          ? `Ran ${formatDateTime(submission.checked_at)}${submission.final_url ? ` · landed on ${submission.final_url}` : ""}`
          : "Not run yet."
      }
    >
      {checks.length === 0 ? (
        <Text color="secondary" display="block">
          {isPending(submission.status) ? "Checks are running." : "No results recorded."}
        </Text>
      ) : (
        <Stack gap={4}>
          {checks.map((check) => (
            <HStack key={check.id} hAlign="between" vAlign="start" gap={4}>
              <Stack gap={0.5}>
                <Text weight="medium">{check.label}</Text>
                <Text type="supporting" color="secondary" display="block">
                  {check.detail}
                </Text>
              </Stack>
              <Badge
                label={CHECK_OUTCOME[check.outcome].label}
                variant={CHECK_OUTCOME[check.outcome].badge}
              />
            </HStack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
