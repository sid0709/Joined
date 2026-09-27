"use client";

import { useRouter } from "next/navigation";
import {
  Button,
  Glyph,
  HStack,
  Heading,
  IconButton,
  Link,
  MoreMenu,
  Stack,
  Text,
  ToggleButton,
  icons,
  type DropdownMenuOption,
} from "@openseat/design-system";
import { formatCount, formatPosted, type Job } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { CompanyLogo } from "./company-logo";
import { JobTags } from "./job-tags";

export type JobDetailHeaderProps = {
  job: Job;
  saved: boolean;
  applied: boolean;
  onApply: () => void;
  onSave: () => void;
  onShare: () => void;
  onHide?: () => void;
  /** Adds “Open full page” — for the split view, not the job page itself. */
  showPageLink?: boolean;
};

/** Who is hiring, for what, and the actions — always in view at the top of a job. */
export function JobDetailHeader({
  job,
  saved,
  applied,
  onApply,
  onSave,
  onShare,
  onHide,
  showPageLink,
}: JobDetailHeaderProps) {
  const router = useRouter();
  const direct = job.source === "direct";
  const menu: DropdownMenuOption[] = [
    ...(showPageLink
      ? [
          {
            label: "Open full page",
            icon: icons.arrowRight,
            onClick: () => router.push(ROUTES.job(job.id)),
          },
        ]
      : []),
    ...(job.companyId
      ? [
          {
            label: "View company",
            icon: icons.seat,
            onClick: () => router.push(ROUTES.companyPublic(job.companyId)),
          },
        ]
      : []),
    ...(onHide
      ? [
          { type: "divider" as const },
          { label: "Not interested", icon: icons.close, onClick: onHide },
        ]
      : []),
  ];

  return (
    <Stack gap={4}>
      <HStack gap={4} vAlign="start">
        <CompanyLogo name={job.company} companyId={job.companyId} src={job.companyLogo} size={60} />
        <Stack gap={1}>
          <Heading level={2}>{job.title}</Heading>
          <Text color="secondary">
            {job.companyId ? (
              <Link href={ROUTES.companyPublic(job.companyId)}>{job.company}</Link>
            ) : (
              job.company
            )}
            {` · ${job.location} · ${formatPosted(job.postedHoursAgo)} · ${formatCount(job.applicants, "applicant")}`}
          </Text>
        </Stack>
      </HStack>
      <JobTags job={job} applied={applied} detailed />
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button
          label={applied ? "Applied" : direct ? "Easy apply" : "Apply on company site"}
          variant="primary"
          icon={<Glyph name={applied ? "check" : direct ? "send" : "share"} />}
          onClick={onApply}
          isDisabled={applied}
        />
        <ToggleButton
          label={saved ? "Saved" : "Save"}
          icon={<Glyph name="bookmark" />}
          isPressed={saved}
          onPressedChange={onSave}
        />
        <IconButton
          label="Copy link"
          icon={<Glyph name="link" />}
          variant="ghost"
          onClick={onShare}
          tooltip="Copy link"
        />
        <MoreMenu items={menu} label="More actions" variant="ghost" />
      </HStack>
    </Stack>
  );
}
