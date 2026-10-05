"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  SectionCard,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "sid-ui";
import type { AcornAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { matchKeywords, postingKeywords, profileText } from "@/lib/workspace/keywords";
import {
  COMPANY_MAX,
  JOB_DESCRIPTION_MAX,
  JOB_DESCRIPTION_ROWS,
  RESUME_LIMIT,
  ROLE_MAX,
  buildResume,
  type ResumeDraft,
} from "@/lib/workspace/model";
import { sampleProfile } from "@/lib/workspace/profile";
import { MatchAnalysis } from "./match-analysis";
import { ResumePreview } from "./resume-preview";
import { useResumes } from "./use-resumes";

/** Paste a posting, check the match, generate. Each draft is saved to History. */
export function ResumeGenerator({ account }: { account: AcornAccount }) {
  const { workspace, update, history, isSampleHistory } = useResumes();
  const [role, setRole] = useState("Senior Software Engineer");
  const [company, setCompany] = useState("Northwind");
  const [description, setDescription] = useState(
    "Build hiring tools.\nOwn the application flow.\nAttach a résumé written for the posting.",
  );
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [error, setError] = useState("");

  const profile = workspace.profile ?? sampleProfile(account);
  const match = matchKeywords(postingKeywords(`${role}\n${description}`), profileText(profile));

  const generate = () => {
    const cleanRole = role.trim();
    if (!cleanRole) {
      setError("Add the role this resume is for.");
      return;
    }
    const next = buildResume(account, profile, cleanRole, company, description);
    const kept = isSampleHistory ? [] : history;
    update({ ...workspace, resumes: [next, ...kept].slice(0, RESUME_LIMIT) });
    setDraft(next);
    setError("");
  };

  return (
    <Stack gap={4}>
      {draft ? (
        <Banner
          status="success"
          title="Draft saved to History"
          description={`${draft.company ? `${draft.role} · ${draft.company}` : draft.role}. History keeps your newest ${RESUME_LIMIT} drafts.`}
          endContent={
            <Button
              label="Open History"
              variant="secondary"
              size="sm"
              href={ROUTES.resumeHistory}
            />
          }
        />
      ) : null}
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
          <ResumePreview account={account} profile={profile} resume={draft} />
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
