import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  List,
  ListItem,
  PageHeader,
  SectionCard,
  Stack,
  StatGrid,
  Text,
  Timeline,
} from "@joined/design-system";
import {
  ApiError,
  LEVEL_BADGE,
  PAYOUT_STATUS,
  SUBMISSION_STATUS,
  VERIFICATION,
  formatMoney,
  formatRate,
  type AdminScoutDetail,
  type Meta,
} from "@joined/scout";
import { ScoutActions } from "@/components/scouting/scouts/scout-actions";
import { ageLabel, formatCount, formatDate, formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import { adminGet } from "@/lib/server/api";

export const metadata: Metadata = { title: "Scout" };

async function load(userId: string) {
  try {
    return await Promise.all([
      adminGet<AdminScoutDetail>(`/v1/admin/scout/scouts/${encodeURIComponent(userId)}`),
      adminGet<Meta>("/v1/admin/scout/meta"),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function ScoutPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [detail, meta] = await load(userId);
  const { profile, metrics, balance } = detail;
  const verification = VERIFICATION[profile.verification];

  return (
    <Stack gap={5}>
      <HStack>
        <Button
          label="Scouts"
          variant="ghost"
          size="sm"
          icon={<Glyph name="chevronLeft" />}
          href={ROUTES.scouts}
        />
      </HStack>
      <PageHeader
        title={profile.name || profile.email}
        description={`${profile.email} · scouting since ${formatDate(profile.created_at)}`}
        action={
          <HStack gap={2} wrap="wrap">
            <Badge label={profile.level} variant={LEVEL_BADGE[profile.level]} />
            <Badge label={verification.label} variant={verification.badge} />
            <Badge label={`Tier ${profile.verification_tier}`} variant="neutral" />
          </HStack>
        }
      />
      <StatGrid
        stats={[
          {
            label: "Approval rate",
            value: formatRate(metrics.approval_rate),
            hint: `${formatCount(metrics.approved)} approved · ${formatCount(metrics.rejected)} rejected`,
          },
          {
            label: "Submitted",
            value: formatCount(metrics.submitted),
            hint: `${formatCount(metrics.submitted_today)} today of ${formatCount(metrics.daily_limit)}`,
          },
          {
            label: "Live jobs",
            value: formatCount(metrics.live),
            hint: `${formatRate(metrics.interview_producing_rate)} produced an interview`,
          },
          {
            label: "Earned",
            value: formatMoney(balance.lifetime),
            hint: `${formatMoney(balance.released)} available · ${formatMoney(balance.paid)} paid`,
          },
        ]}
      />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            <SectionCard
              title="Recent submissions"
              action={
                <Button
                  label="All"
                  variant="ghost"
                  size="sm"
                  href={`${ROUTES.queue}?status=all&q=${encodeURIComponent(profile.email)}`}
                />
              }
            >
              {detail.submissions.length === 0 ? (
                <Text color="secondary" display="block">
                  Nothing submitted yet.
                </Text>
              ) : (
                <List density="compact">
                  {detail.submissions.map((sub) => (
                    <ListItem
                      key={sub.id}
                      href={ROUTES.submission(sub.id)}
                      label={sub.title}
                      description={`${sub.company_name} · ${sub.host}`}
                      startContent={
                        <Badge
                          label={SUBMISSION_STATUS[sub.status].label}
                          variant={SUBMISSION_STATUS[sub.status].badge}
                        />
                      }
                      endContent={
                        <Text type="supporting" color="secondary">
                          {ageLabel(sub.submitted_at)}
                        </Text>
                      }
                    />
                  ))}
                </List>
              )}
            </SectionCard>
            <SectionCard title="Payouts">
              {detail.payouts.length === 0 ? (
                <Text color="secondary" display="block">
                  No payouts requested.
                </Text>
              ) : (
                <List density="compact">
                  {detail.payouts.map((payout) => (
                    <ListItem
                      key={payout.id}
                      href={ROUTES.payouts}
                      label={formatMoney(payout.amount)}
                      description={`${payout.method.label} •••• ${payout.method.last4} · ${formatDate(payout.requested_at)}`}
                      startContent={
                        <Badge
                          label={PAYOUT_STATUS[payout.status].label}
                          variant={PAYOUT_STATUS[payout.status].badge}
                        />
                      }
                    />
                  ))}
                </List>
              )}
            </SectionCard>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <ScoutActions detail={detail} levels={meta.levels} />
            <SectionCard title="Staff history">
              {detail.audit.length === 0 ? (
                <Text color="secondary" display="block">
                  No staff changes yet.
                </Text>
              ) : (
                <Timeline
                  label="Staff history"
                  items={detail.audit.map((entry, index) => ({
                    id: `audit-${index}`,
                    title: entry.action.replace(/^scout\./, "").replace(/[._]/g, " "),
                    description: [entry.actor, entry.note].filter(Boolean).join(" · "),
                    time: formatDateTime(entry.at),
                    status: "done",
                  }))}
                />
              )}
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
