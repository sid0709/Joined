"use client";

import {
  Avatar,
  Badge,
  Banner,
  Button,
  Drawer,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  MoreMenu,
  Selector,
  Stack,
  Step,
  Stepper,
  Timeline,
} from "@joined/design-system";
import type { ApplicationFollowUpPatch } from "@/components/applications/application-follow-up";
import { ApplicationFollowUp } from "@/components/applications/application-follow-up";
import {
  PIPELINE_STAGES,
  SOURCE_LABEL,
  STAGE_BY_ID,
  STRONG_MATCH,
  isSavedBoardItem,
  stageSelectorOptions,
  type Application,
  type ApplicationStage,
} from "@/lib/applications";
import { formatShortDate } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

const LOGO_SIZE = 40;

/** Everything about one application, with its stage, notes, and reminder editable. */
export function ApplicationDrawer({
  application,
  onClose,
  onStageChange,
  onFollowUp,
  onRemove,
}: {
  application: Application | null;
  onClose: () => void;
  onStageChange: (id: string, stage: ApplicationStage) => void;
  onFollowUp: (id: string, patch: ApplicationFollowUpPatch) => void;
  onRemove: (id: string) => void;
}) {
  if (!application) return null;

  const saved = isSavedBoardItem(application);
  const stage = STAGE_BY_ID[application.columnId];
  const step = PIPELINE_STAGES.indexOf(application.columnId);
  const activity = application.activity.map((event, index) => ({
    id: event.id,
    title: event.label,
    time: formatShortDate(event.date),
    status: index === 0 ? ("current" as const) : ("done" as const),
  }));

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => (open ? null : onClose())}
      title={application.title}
      subtitle={`${application.company} · ${application.location}`}
      headerStart={
        <Avatar name={application.company} size={LOGO_SIZE} shape="rounded" tooltip={false} />
      }
      headerActions={
        <MoreMenu
          label="More actions"
          items={
            saved
              ? [
                  {
                    label: "Remove from saved",
                    variant: "destructive",
                    onClick: () => onRemove(application.id),
                  },
                ]
              : [
                  {
                    label: "Withdraw application",
                    onClick: () => onStageChange(application.id, "closed"),
                  },
                  { type: "divider" },
                  {
                    label: "Remove from tracker",
                    variant: "destructive",
                    onClick: () => onRemove(application.id),
                  },
                ]
          }
        />
      }
      footer={
        <HStack gap={2} hAlign="end">
          {application.jobId ? (
            <Button
              label="View job posting"
              variant="secondary"
              href={ROUTES.job(application.jobId)}
            />
          ) : null}
          <Button label="Done" variant="primary" onClick={onClose} />
        </HStack>
      }
    >
      <Stack gap={6}>
        <HStack gap={2} wrap="wrap">
          <Badge label={application.closedReason ?? stage.title} variant={stage.badge} />
          <Badge
            label={`${application.match}% match`}
            variant={application.match >= STRONG_MATCH ? "success" : "neutral"}
          />
          <Badge label={SOURCE_LABEL[application.source]} variant="neutral" />
        </HStack>

        {saved ? (
          <Banner
            status="info"
            title="Saved job"
            description="Same as Save on the job board. Move this card to Applied when you send it."
          />
        ) : null}

        {application.nextStep ? (
          <Banner status="info" title="Next step" description={application.nextStep} />
        ) : null}

        {saved ? null : (
          <Stepper activeStep={Math.max(step, 0)} label="Application progress" density="compact">
            {PIPELINE_STAGES.map((id, index) => (
              <Step
                key={id}
                step={index}
                label={STAGE_BY_ID[id].title}
                status={application.columnId === "closed" && index > step ? "error" : undefined}
              />
            ))}
          </Stepper>
        )}

        <Selector
          label="Stage"
          options={stageSelectorOptions(application)}
          value={application.columnId}
          onChange={(value) => onStageChange(application.id, value as ApplicationStage)}
        />

        <MetadataList columns={2}>
          <MetadataListItem label="Pay">{application.salary}</MetadataListItem>
          <MetadataListItem label="Resume">{application.resume}</MetadataListItem>
          <MetadataListItem label="Source">{SOURCE_LABEL[application.source]}</MetadataListItem>
          <MetadataListItem label="Last update">
            {formatShortDate(application.updated)}
          </MetadataListItem>
        </MetadataList>

        <Stack gap={3}>
          <Heading level={3}>Activity</Heading>
          <Timeline label="Activity" items={activity} variant="compact" />
        </Stack>

        <ApplicationFollowUp
          application={application}
          onSave={(patch) => onFollowUp(application.id, patch)}
        />
      </Stack>
    </Drawer>
  );
}
