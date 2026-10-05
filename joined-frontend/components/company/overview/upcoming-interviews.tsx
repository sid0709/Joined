import { Badge, Button, Divider, EmptyState, Glyph, HStack, Stack, Text } from "sid-ui";
import { DateBadge } from "@/components/date-badge";
import { SectionCard } from "@/components/section-card";
import { INTERVIEW_STATUS_META, type CompanyInterview } from "@/lib/company";
import { formatTime, relativeDay, startOfDay } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

const SHOWN = 3;

/** The next few rounds on the team calendar. */
export function UpcomingInterviews({ interviews }: { interviews: CompanyInterview[] }) {
  const today = startOfDay(new Date()).getTime();
  const next = interviews
    .filter((item) => item.date.getTime() >= today && item.status !== "no-show")
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
      {next.length === 0 ? (
        <EmptyState
          isCompact
          title="No interviews scheduled"
          description="Schedule one from an applicant."
        />
      ) : (
        <Stack gap={4}>
          {next.map((item, index) => (
            <Stack key={item.id} gap={4}>
              {index > 0 ? <Divider /> : null}
              <HStack gap={3} vAlign="center">
                <DateBadge date={item.date} />
                <Stack gap={0.5}>
                  <Text weight="semibold">{item.candidate}</Text>
                  <Text type="supporting" color="secondary">
                    {item.jobTitle}
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
      )}
    </SectionCard>
  );
}
