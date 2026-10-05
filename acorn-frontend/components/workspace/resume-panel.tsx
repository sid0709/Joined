"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  GridSystem,
  GridColumn,
  Heading,
  HStack,
  PageHeader,
  SectionCard,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@joined/design-system";
import type { AcornAccount } from "@/lib/auth/session";
import {
  COMPANY_MAX,
  JOB_DESCRIPTION_MAX,
  JOB_DESCRIPTION_ROWS,
  RESUME_LIMIT,
  ROLE_MAX,
  buildResume,
  formatWhen,
  type ResumeDraft,
} from "@/lib/workspace/model";
import { sampleProfile } from "@/lib/workspace/profile";
import { useWorkspace } from "./use-workspace";

export function ResumePanel({ account }: { account: AcornAccount }) {
  const { workspace, update } = useWorkspace();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selected =
    workspace.resumes.find((resume) => resume.id === selectedId) ?? workspace.resumes[0] ?? null;

  const generate = () => {
    const cleanRole = role.trim();
    if (!cleanRole) {
      setError("Add the role this resume is for.");
      return;
    }
    const draft = buildResume(
      account,
      workspace.profile ?? sampleProfile(account),
      cleanRole,
      company,
      description,
    );
    const resumes = [draft, ...workspace.resumes].slice(0, RESUME_LIMIT);
    update({ ...workspace, resumes });
    setSelectedId(draft.id);
    setError("");
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Resume"
        description="Write a draft aimed at one posting. Acorn shapes it from your profile."
      />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={5}>
          <SectionCard
            title="New draft"
            description="Paste the posting. Acorn shapes a draft from your profile."
            action={<Button label="Generate" variant="primary" onClick={generate} />}
          >
            <Stack gap={4}>
              <TextInput
                label="Role"
                value={role}
                onChange={(value) => setRole(value.slice(0, ROLE_MAX))}
                placeholder="Product Designer"
                isRequired
              />
              <TextInput
                label="Company"
                value={company}
                onChange={(value) => setCompany(value.slice(0, COMPANY_MAX))}
                placeholder="Northwind"
                isOptional
              />
              <TextArea
                label="Job description"
                value={description}
                onChange={(value) => setDescription(value.slice(0, JOB_DESCRIPTION_MAX))}
                rows={JOB_DESCRIPTION_ROWS}
                maxLength={JOB_DESCRIPTION_MAX}
                isOptional
                description="Lines from the posting become the focus of the draft."
              />
              {error ? <Text color="secondary">{error}</Text> : null}
            </Stack>
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={7}>
          <ResumePreview account={account} resume={selected} />
        </GridColumn>
      </GridSystem>
      {workspace.resumes.length > 1 ? (
        <SectionCard title="Drafts" description="The newest draft is kept at the top.">
          <Stack gap={4}>
            {workspace.resumes.map((resume) => (
              <HStack key={resume.id} hAlign="between" vAlign="center" wrap="wrap" gap={3}>
                <Stack gap={1}>
                  <Text weight="semibold">
                    {resume.company ? `${resume.role} · ${resume.company}` : resume.role}
                  </Text>
                  {formatWhen(resume.createdAt) ? (
                    <Text color="secondary">{formatWhen(resume.createdAt)}</Text>
                  ) : null}
                </Stack>
                <Button
                  label={resume.id === selected?.id ? "Showing" : "View"}
                  variant={resume.id === selected?.id ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setSelectedId(resume.id)}
                />
              </HStack>
            ))}
          </Stack>
        </SectionCard>
      ) : null}
    </Stack>
  );
}

function ResumePreview({ account, resume }: { account: AcornAccount; resume: ResumeDraft | null }) {
  if (!resume) {
    return (
      <SectionCard title="Preview" description="A generated resume shows up here.">
        <Text color="secondary">Add a role, then generate.</Text>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={resume.role}
      description={resume.company || account.email}
      action={<Badge label="Draft" variant="blue" />}
    >
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={3}>{account.name}</Heading>
          <Text color="secondary">{account.email}</Text>
        </Stack>
        <Text>{resume.summary}</Text>
        {resume.focus.length > 0 ? (
          <Stack gap={2}>
            <Text weight="semibold">From the posting</Text>
            {resume.focus.map((line) => (
              <Text key={line} color="secondary">
                {line}
              </Text>
            ))}
          </Stack>
        ) : null}
        {formatWhen(resume.createdAt) ? (
          <Text color="secondary">Generated {formatWhen(resume.createdAt)}</Text>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
