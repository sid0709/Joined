"use client";

import {
  Heading,
  PageHeader,
  SectionCard,
  SegmentBar,
  Stack,
  StatGrid,
  Text,
} from "@joined/design-system";
import type { AcornAccount } from "@/lib/auth/session";
import { firstName } from "@/lib/workspace/model";
import { sampleProfile } from "@/lib/workspace/profile";
import { useWorkspace } from "./use-workspace";

export function OverviewPanel({ account }: { account: AcornAccount }) {
  const { workspace } = useWorkspace();

  const profile = workspace.profile ?? sampleProfile(account);
  const drafts = workspace.resumes.length || 3;
  const mailboxes = workspace.mailboxes.length || 2;
  const roles = profile.timeline.filter((entry) => entry.kind === "role").length;
  const activity =
    workspace.resumes.length + workspace.mailboxes.length > 0
      ? [
          ...workspace.resumes.map((resume) => ({
            id: resume.id,
            title: resume.company ? `${resume.role} · ${resume.company}` : resume.role,
            detail: "Resume draft",
          })),
          ...workspace.mailboxes.map((mailbox) => ({
            id: mailbox.id,
            title: mailbox.email,
            detail: "Gmail connected",
          })),
        ]
      : [
          ...profile.timeline.map((entry) => ({
            id: entry.id,
            title: `${entry.title} · ${entry.org}`,
            detail: entry.kind === "education" ? "Education" : "Role",
          })),
          { id: "mail-northwind", title: "Interview request · Northwind", detail: "Gmail" },
          { id: "mail-lumen", title: "Application received · Lumen", detail: "Gmail" },
        ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={`Welcome back, ${firstName(account.name)}.`}
        description="Applications, your profile, resumes, and Gmail live here."
      />
      <StatGrid
        stats={[
          { label: "Resumes", value: String(drafts), hint: "Drafts ready to attach" },
          { label: "Gmail", value: String(mailboxes), hint: "Mailboxes watching replies" },
          { label: "Roles", value: String(roles), hint: "On the career timeline" },
          { label: "Applications", value: "18", hint: "Saved, applied, and in conversation" },
        ]}
      />
      <SectionCard title="Pipeline" description="Saved, applied, replied, and interviews.">
        <SegmentBar
          unit="applications"
          segments={[
            { label: "Saved", value: 4, tone: "neutral" },
            { label: "Applied", value: 18, tone: "blue" },
            { label: "Replied", value: 6, tone: "green" },
            { label: "Interview", value: 2, tone: "orange" },
          ]}
        />
      </SectionCard>
      <SectionCard title="Recent" description="Resumes you generated and mailboxes you connected.">
        <Stack gap={4}>
          {activity.slice(0, 6).map((item) => (
            <Stack key={item.id} gap={1}>
              <Heading level={3}>{item.title}</Heading>
              <Text color="secondary">{item.detail}</Text>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
