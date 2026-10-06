"use client";

import {
  Badge,
  Card,
  HStack,
  MoreMenu,
  SelectableCard,
  Stack,
  StatusDot,
  Text,
  formatBytes,
} from "sid-ui";
import { formatShortDate } from "@/lib/dates";
import { PARSE_META, isProfileResume, type Resume } from "@/lib/resumes";
import { ResumePagePreview } from "./resume-page-preview";

const PREVIEW_WIDTH = 132;

export type ResumeAction = "default" | "rename" | "download" | "delete";

/** One resume version: a sketched page, its label, and quick actions. */
export function ResumeCard({
  resume,
  isSelected,
  onSelect,
  onAction,
}: {
  resume: Resume;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: ResumeAction) => void;
}) {
  const parse = PARSE_META[resume.parse];
  const locked = isProfileResume(resume.id);

  return (
    <SelectableCard label={resume.label} isSelected={isSelected} onChange={onSelect} padding={4}>
      <Stack gap={4}>
        <Card variant="muted" padding={5}>
          <Stack hAlign="center">
            <Stack width={PREVIEW_WIDTH}>
              <ResumePagePreview />
            </Stack>
          </Stack>
        </Card>

        <Stack gap={1}>
          <HStack hAlign="between" vAlign="center" gap={2}>
            <HStack gap={2} vAlign="center">
              <Text weight="semibold" maxLines={1}>
                {resume.label}
              </Text>
              {resume.isDefault ? <Badge label="Default" variant="blue" /> : null}
            </HStack>
            <MoreMenu
              label={`Actions for ${resume.label}`}
              size="sm"
              items={[
                {
                  label: "Set as default",
                  isDisabled: resume.isDefault || resume.parse !== "parsed",
                  onClick: () => onAction("default"),
                },
                { label: "Rename", isDisabled: locked, onClick: () => onAction("rename") },
                {
                  label: locked ? "Export" : "Download",
                  onClick: () => onAction("download"),
                },
                { type: "divider" },
                {
                  label: "Delete",
                  variant: "destructive",
                  isDisabled: locked || resume.isDefault,
                  onClick: () => onAction("delete"),
                },
              ]}
            />
          </HStack>
          <Text type="supporting" color="secondary" maxLines={1}>
            {formatBytes(resume.sizeBytes)} · Updated {formatShortDate(resume.updated)}
          </Text>
        </Stack>

        <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
          <HStack gap={2} vAlign="center">
            <StatusDot
              variant={parse.dot}
              label={parse.label}
              isPulsing={resume.parse === "parsing"}
            />
            <Text type="supporting">{parse.label}</Text>
          </HStack>
          <Text type="supporting" color="secondary">
            {resume.usedIn === 1 ? "Used once" : `Used ${resume.usedIn}×`}
          </Text>
        </HStack>
      </Stack>
    </SelectableCard>
  );
}
