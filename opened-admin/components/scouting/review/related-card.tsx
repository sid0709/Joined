import { Badge, Banner, List, ListItem, SectionCard, Stack, Text } from "@openseat/design-system";
import { SUBMISSION_STATUS, type AdminSubmissionDetail, type Submission } from "@openseat/scout";
import { ageLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

function Row({ sub }: { sub: Submission }) {
  const status = SUBMISSION_STATUS[sub.status];
  return (
    <ListItem
      href={ROUTES.submission(sub.id)}
      label={sub.title}
      description={`${sub.company_name} · ${sub.host}`}
      startContent={<Badge label={status.label} variant={status.badge} />}
      endContent={
        <Text type="supporting" color="secondary">
          {ageLabel(sub.submitted_at)}
        </Text>
      }
    />
  );
}

/** Other submissions of the same link or role, and the scout's own recent work. */
export function RelatedCard({ detail }: { detail: AdminSubmissionDetail }) {
  const duplicate = detail.duplicate_of_submission;
  return (
    <SectionCard
      title="Context"
      description="Duplicates are decided by the first approved submission."
    >
      <Stack gap={4}>
        {duplicate ? (
          <Banner
            status="info"
            title={`Matches "${duplicate.title}" (${SUBMISSION_STATUS[duplicate.status].label.toLowerCase()})`}
            description={`${duplicate.company_name} · submitted ${ageLabel(duplicate.submitted_at)} ago`}
          />
        ) : null}
        <Stack gap={1}>
          <Text weight="semibold">Same link or role</Text>
          {detail.related.length === 0 ? (
            <Text type="supporting" color="secondary" display="block">
              No other submission shares this link, company, title, and location.
            </Text>
          ) : (
            <List density="compact">
              {detail.related.map((sub) => (
                <Row key={sub.id} sub={sub} />
              ))}
            </List>
          )}
        </Stack>
        <Stack gap={1}>
          <Text weight="semibold">This scout&apos;s recent submissions</Text>
          {detail.scout_recent.length === 0 ? (
            <Text type="supporting" color="secondary" display="block">
              This is their first submission.
            </Text>
          ) : (
            <List density="compact">
              {detail.scout_recent.map((sub) => (
                <Row key={sub.id} sub={sub} />
              ))}
            </List>
          )}
        </Stack>
      </Stack>
    </SectionCard>
  );
}
