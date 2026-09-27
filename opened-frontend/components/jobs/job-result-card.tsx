import { Glyph, HStack, Stack, SelectableCard, Text, ToggleButton } from "@openseat/design-system";
import { formatCount, formatPay, formatPosted, type Job } from "@/lib/jobs";
import { CompanyLogo } from "./company-logo";
import { JobTags } from "./job-tags";
import { MatchBadge } from "./match-badge";

export type JobResultCardProps = {
  job: Job;
  score: number;
  selected: boolean;
  saved: boolean;
  applied: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
};

/** One search result: who, what, where, pay, and fit — with save in reach. */
export function JobResultCard({
  job,
  score,
  selected,
  saved,
  applied,
  onSelect,
  onToggleSave,
}: JobResultCardProps) {
  return (
    <SelectableCard
      label={`${job.title} at ${job.company}`}
      isSelected={selected}
      onChange={onSelect}
      padding={4}
      data-job-id={job.id}
    >
      <HStack gap={3} vAlign="start">
        <CompanyLogo name={job.company} size={48} />
        <Stack gap={2} width="100%">
          <HStack hAlign="between" vAlign="start" gap={2}>
            <Stack gap={0.5}>
              <Text weight="semibold" size="lg" maxLines={1} hasTruncateTooltip>
                {job.title}
              </Text>
              <Text type="supporting" color="secondary" maxLines={1}>
                {job.company} · {job.location}
              </Text>
            </Stack>
            <ToggleButton
              label={saved ? "Remove from saved" : "Save job"}
              icon={<Glyph name="bookmark" />}
              isIconOnly
              size="sm"
              isPressed={saved}
              onPressedChange={onToggleSave}
              tooltip={saved ? "Saved" : "Save"}
            />
          </HStack>
          <JobTags job={job} applied={applied} />
          <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
            <HStack gap={3} vAlign="center" wrap="wrap">
              <Text weight="medium" hasTabularNumbers>
                {formatPay(job.pay)}
              </Text>
              <Text type="supporting" color="secondary">
                {formatPosted(job.postedHoursAgo)} · {formatCount(job.applicants, "applicant")}
              </Text>
            </HStack>
            <MatchBadge score={score} />
          </HStack>
        </Stack>
      </HStack>
    </SelectableCard>
  );
}
