"use client";

import { useState } from "react";
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
  TextArea,
  Timeline,
  type TimelineItem,
} from "@joined/design-system";
import {
  SOURCE_LABEL,
  STAGE_BY_ID,
  STAGES,
  STRONG_MATCH,
  type Application,
  type ApplicationStage,
} from "@/lib/applications";
import { formatShortDate } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

const LOGO_SIZE = 40;
const NOTE_ROWS = 4;
/** The forward path shown in the stepper; Saved and Closed sit outside it. */
const PIPELINE: ApplicationStage[] = ["applied", "screening", "interview", "offer"];
const STAGE_OPTIONS = STAGES.map((stage) => ({ value: stage.id, label: stage.title }));

/** Everything about one application, with its stage editable in place. */
export function ApplicationDrawer({
  application,
  onClose,
  onStageChange,
  onRemove,
}: {
  application: Application | null;
  onClose: () => void;
  onStageChange: (id: string, stage: ApplicationStage) => void;
  onRemove: (id: string) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!application) return null;

  const stage = STAGE_BY_ID[application.columnId];
  const step = PIPELINE.indexOf(application.columnId);
  const activity: TimelineItem[] = application.activity.map((event, index) => ({
    id: event.id,
    title: event.label,
    time: formatShortDate(event.date),
    status: index === 0 ? "current" : "done",
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
          items={[
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
          ]}
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

        {application.nextStep ? (
          <Banner status="info" title="Next step" description={application.nextStep} />
        ) : null}

        <Stepper activeStep={Math.max(step, 0)} label="Application progress" density="compact">
          {PIPELINE.map((id, index) => (
            <Step
              key={id}
              step={index}
              label={STAGE_BY_ID[id].title}
              status={application.columnId === "closed" && index > step ? "error" : undefined}
            />
          ))}
        </Stepper>

        <Selector
          label="Stage"
          options={STAGE_OPTIONS}
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

        <TextArea
          label="Private notes"
          description="Only you can see these."
          value={notes[application.id] ?? ""}
          onChange={(value) => setNotes((current) => ({ ...current, [application.id]: value }))}
          rows={NOTE_ROWS}
          placeholder="Who you spoke with, what they asked, what to follow up on…"
        />
      </Stack>
    </Drawer>
  );
}
