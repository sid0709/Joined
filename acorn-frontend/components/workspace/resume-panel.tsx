"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  GridColumn,
  GridSystem,
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
  type LibraryResume,
  type ResumeDraft,
} from "@/lib/workspace/model";
import { sampleProfile } from "@/lib/workspace/profile";
import { useWorkspace } from "./use-workspace";

const LIBRARY_LIMIT = 20;

const SAMPLE_HISTORY: ResumeDraft[] = [
  {
    id: "sample-northwind",
    role: "Senior Software Engineer",
    company: "Northwind",
    summary: "A draft aimed at Northwind's senior engineer posting, using the career timeline.",
    focus: ["Hiring tools", "Application flow", "Resume attachment"],
    createdAt: "2026-09-28T15:00:00.000Z",
  },
  {
    id: "sample-lumen",
    role: "Software Engineer",
    company: "Lumen",
    summary: "A draft aimed at Lumen, emphasizing search, profiles, and mail.",
    focus: ["Search", "Profiles", "Mail"],
    createdAt: "2026-09-12T15:00:00.000Z",
  },
  {
    id: "sample-harbor",
    role: "Software Engineer",
    company: "Harbor Health",
    summary: "A draft aimed at Harbor Health's scheduling team.",
    focus: ["Scheduling", "Internal tools"],
    createdAt: "2026-08-30T15:00:00.000Z",
  },
];

const SAMPLE_LIBRARY: LibraryResume[] = [
  {
    id: "lib-upload",
    name: "Jordan-Lee-resume.pdf",
    source: "upload",
    detail: "Uploaded résumé",
    addedAt: "2026-09-02T15:00:00.000Z",
  },
  {
    id: "sample-northwind",
    name: "Senior Software Engineer · Northwind",
    source: "generated",
    detail: "Generated draft",
    addedAt: "2026-09-28T15:00:00.000Z",
  },
  {
    id: "sample-lumen",
    name: "Software Engineer · Lumen",
    source: "generated",
    detail: "Generated draft",
    addedAt: "2026-09-12T15:00:00.000Z",
  },
];

export function ResumePanel({ account }: { account: AcornAccount }) {
  const { workspace, update } = useWorkspace();
  const [role, setRole] = useState("Senior Software Engineer");
  const [company, setCompany] = useState("Northwind");
  const [description, setDescription] = useState(
    "Build hiring tools.\nOwn the application flow.\nAttach a résumé written for the posting.",
  );
  const [selectedId, setSelectedId] = useState<string | null>("sample-northwind");
  const [error, setError] = useState("");

  const history = workspace.resumes.length > 0 ? workspace.resumes : SAMPLE_HISTORY;
  const library = workspace.library.length > 0 ? workspace.library : SAMPLE_LIBRARY;
  const selected = history.find((resume) => resume.id === selectedId) ?? history[0] ?? null;

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
    const item: LibraryResume = {
      id: draft.id,
      name: draft.company ? `${draft.role} · ${draft.company}` : draft.role,
      source: "generated",
      detail: "Generated draft",
      addedAt: draft.createdAt,
    };
    update({
      ...workspace,
      resumes: [draft, ...history].slice(0, RESUME_LIMIT),
      library: [item, ...library.filter((entry) => entry.id !== draft.id)].slice(0, LIBRARY_LIMIT),
    });
    setSelectedId(draft.id);
    setError("");
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Resume"
        description="Generate a draft for one posting, keep the files you use, and look back at every generation."
      />
      <SectionCard
        title="Resume generator"
        description="Paste the posting. Acorn shapes a draft from your profile."
        action={<Button label="Generate" variant="primary" onClick={generate} />}
      >
        <GridSystem gap={6} align="start">
          <GridColumn span="full" lg={5}>
            <Stack gap={4}>
              <TextInput
                label="Role"
                value={role}
                onChange={(value) => setRole(value.slice(0, ROLE_MAX))}
                isRequired
              />
              <TextInput
                label="Company"
                value={company}
                onChange={(value) => setCompany(value.slice(0, COMPANY_MAX))}
                isOptional
              />
              <TextArea
                label="Job description"
                value={description}
                onChange={(value) => setDescription(value.slice(0, JOB_DESCRIPTION_MAX))}
                rows={JOB_DESCRIPTION_ROWS}
                maxLength={JOB_DESCRIPTION_MAX}
                description="Lines from the posting become the focus of the draft."
              />
              {error ? <Text color="secondary">{error}</Text> : null}
            </Stack>
          </GridColumn>
          <GridColumn span="full" lg={7}>
            <ResumePreview account={account} resume={selected} />
          </GridColumn>
        </GridSystem>
      </SectionCard>
      <SectionCard
        title="Resume library"
        description="Uploads from Profile and drafts you generated."
      >
        <Stack gap={4}>
          {library.map((item) => (
            <HStack key={item.id} hAlign="between" vAlign="center" wrap="wrap" gap={3}>
              <Stack gap={1}>
                <Text weight="semibold">{item.name}</Text>
                <Text color="secondary">
                  {item.detail}
                  {formatWhen(item.addedAt) ? ` · ${formatWhen(item.addedAt)}` : ""}
                </Text>
              </Stack>
              <HStack gap={2} vAlign="center">
                <Badge
                  label={item.source === "upload" ? "Upload" : "Generated"}
                  variant={item.source === "upload" ? "neutral" : "blue"}
                />
                {history.some((resume) => resume.id === item.id) ? (
                  <Button
                    label={item.id === selected?.id ? "Showing" : "View"}
                    variant={item.id === selected?.id ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedId(item.id)}
                  />
                ) : null}
              </HStack>
            </HStack>
          ))}
        </Stack>
      </SectionCard>
      <SectionCard title="Generation history" description="Newest first. Each Generate adds a row.">
        <Stack gap={4}>
          {history.map((resume) => (
            <HStack key={resume.id} hAlign="between" vAlign="center" wrap="wrap" gap={3}>
              <Stack gap={1}>
                <Heading level={3}>
                  {resume.company ? `${resume.role} · ${resume.company}` : resume.role}
                </Heading>
                <Text color="secondary">{formatWhen(resume.createdAt)}</Text>
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
    </Stack>
  );
}

function ResumePreview({ account, resume }: { account: AcornAccount; resume: ResumeDraft | null }) {
  if (!resume) {
    return (
      <SectionCard title="Preview" description="A generated résumé shows up here.">
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
