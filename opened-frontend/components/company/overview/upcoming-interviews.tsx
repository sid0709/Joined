import { Badge, Button, Divider, Glyph, HStack, Stack, Text } from "@openseat/design-system";
import { DateBadge } from "@/components/date-badge";
import { SectionCard } from "@/components/section-card";
import { COMPANY_INTERVIEWS, INTERVIEW_STATUS_META, jobTitle } from "@/lib/company";
import { formatTime, relativeDay, startOfDay } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

const SHOWN = 3;

/** The next few rounds on the team calendar. */
export function UpcomingInterviews() {
  const today = startOfDay(new Date()).getTime();
  const next = COMPANY_INTERVIEWS.filter((item) => item.date.getTime() >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.start.localeCompare(b.start))
    .slice(0, SHOWN);

  return (
    <SectionCard
      title="Next interviews"
      action={
        <Button
          label="Calendar"
          variant="ghost"
          size="sm"
          href={ROUTES.companyInterviews}
          icon={<Glyph name="arrowRight" />}
        />
      }
    >
      <Stack gap={4}>
        {next.map((item, index) => (
          <Stack key={item.id} gap={4}>
            {index > 0 ? <Divider /> : null}
            <HStack gap={3} vAlign="center">
              <DateBadge date={item.date} />
              <Stack gap={0.5}>
                <Text weight="semibold">{item.candidate}</Text>
                <Text type="supporting" color="secondary">
                  {jobTitle(item.jobId)}
                </Text>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="supporting">
                    {relativeDay(item.date)} · {formatTime(item.start)}
                  </Text>
                  {item.status !== "scheduled" ? (
                    <Badge
                      label={INTERVIEW_STATUS_META[item.status].label}
                      variant={INTERVIEW_STATUS_META[item.status].badge}
                    />
                  ) : null}
                </HStack>
              </Stack>
            </HStack>
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
