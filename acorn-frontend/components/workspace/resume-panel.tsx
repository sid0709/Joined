"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  PageHeader,
  SectionCard,
  Stack,
  StatGrid,
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
import { matchKeywords, postingKeywords, profileText } from "@/lib/workspace/keywords";
import { sampleProfile } from "@/lib/workspace/profile";
import { GenerationHistory } from "./resume/generation-history";
import { MatchAnalysis } from "./resume/match-analysis";
import { ResumeLibrary } from "./resume/resume-library";
import { ResumePreview } from "./resume/resume-preview";
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
  const profile = workspace.profile ?? sampleProfile(account);

  const generate = () => {
    const cleanRole = role.trim();
    if (!cleanRole) {
      setError("Add the role this resume is for.");
      return;
    }
    const draft = buildResume(account, profile, cleanRole, company, description);
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

  const match = matchKeywords(postingKeywords(`${role}\n${description}`), profileText(profile));
  const uploads = library.filter((item) => item.source === "upload").length;
  const latest = history[0];

  return (
    <Stack gap={6}>
      <PageHeader
        title="Resume"
        description="Generate a draft for one posting, see how well your profile covers it, and keep every file in one library."
        action={
          <Button
            label="Generate draft"
            variant="primary"
            icon={<Glyph name="sparkle" />}
            onClick={generate}
          />
        }
      />
      <StatGrid
        stats={[
          {
            label: "Drafts generated",
            value: String(history.length),
            hint: `Keeps the newest ${RESUME_LIMIT}`,
          },
          {
            label: "In the library",
            value: String(library.length),
            hint: "Ready for Acorn to attach",
          },
          { label: "Uploads", value: String(uploads), hint: "Résumés you added on Profile" },
          {
            label: "Last generated",
            value: latest ? formatWhen(latest.createdAt) || "—" : "—",
            hint: latest ? (latest.company ? `For ${latest.company}` : latest.role) : "Nothing yet",
          },
        ]}
      />
      <GridSystem gap={4} align="start">
        <GridColumn span="full" lg={5}>
          <Stack gap={4}>
            <SectionCard
              title="Posting"
              description="Paste the job. Lines from it become the focus of the draft."
              footer={
                <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
                  <Text type="supporting" color="secondary">
                    {`${description.length.toLocaleString()} / ${JOB_DESCRIPTION_MAX.toLocaleString()} characters`}
                  </Text>
                  <Button
                    label="Generate draft"
                    variant="primary"
                    icon={<Glyph name="sparkle" />}
                    onClick={generate}
                  />
                </HStack>
              }
            >
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
                />
                {error ? <Banner status="error" title={error} /> : null}
              </Stack>
            </SectionCard>
            <SectionCard
              title="Profile match"
              description="The posting's most repeated words, checked against your career timeline."
            >
              <MatchAnalysis match={match} />
            </SectionCard>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={7}>
          <ResumePreview account={account} profile={profile} resume={selected} />
        </GridColumn>
      </GridSystem>
      <GridSystem gap={4} align="start">
        <GridColumn span="full" lg={7}>
          <SectionCard title="Library" description="Uploads from Profile and the drafts you kept.">
            <ResumeLibrary
              items={library}
              selectedId={selected?.id ?? null}
              canView={(id) => history.some((resume) => resume.id === id)}
              onView={setSelectedId}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <SectionCard title="History" description="Newest first. Each Generate adds a row.">
            <GenerationHistory
              history={history}
              selectedId={selected?.id ?? null}
              onView={setSelectedId}
            />
          </SectionCard>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
