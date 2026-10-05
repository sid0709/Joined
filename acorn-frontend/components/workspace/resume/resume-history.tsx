"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  EmptyState,
  Glyph,
  GridColumn,
  GridSystem,
  SectionCard,
  Stack,
  StatGrid,
} from "sid-ui";
import type { AcornAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { RESUME_LIMIT, formatWhen } from "@/lib/workspace/model";
import { sampleProfile } from "@/lib/workspace/profile";
import { GenerationHistory } from "./generation-history";
import { ResumePreview } from "./resume-preview";
import { useResumes } from "./use-resumes";

/** Every draft you generated, newest first, with the selected one previewed. */
export function ResumeHistory({ account }: { account: AcornAccount }) {
  const { workspace, update, history, isSampleHistory } = useResumes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = history.find((resume) => resume.id === selectedId) ?? history[0] ?? null;
  const profile = workspace.profile ?? sampleProfile(account);
  const companies = new Set(history.map((resume) => resume.company).filter(Boolean)).size;
  const latest = history[0];

  const remove = (id: string) => {
    update({ ...workspace, resumes: history.filter((resume) => resume.id !== id) });
    setSelectedId(null);
  };

  return (
    <Stack gap={4}>
      <StatGrid
        stats={[
          {
            label: "Drafts",
            value: String(history.length),
            hint: `Keeps the newest ${RESUME_LIMIT}`,
          },
          { label: "Companies", value: String(companies), hint: "Targeted by a draft" },
          {
            label: "Last generated",
            value: latest ? formatWhen(latest.createdAt) || "—" : "—",
            hint: latest ? latest.company || latest.role : "Nothing yet",
          },
        ]}
      />
      {isSampleHistory ? (
        <Banner
          status="info"
          title="Sample drafts"
          description="Generate your first draft and these placeholders go away."
          endContent={
            <Button label="Generate" variant="secondary" size="sm" href={ROUTES.resume} />
          }
        />
      ) : null}
      {history.length === 0 ? (
        <EmptyState
          icon={<Glyph name="sparkle" />}
          title="No drafts yet"
          description="Every draft you generate is kept here."
          actions={<Button label="Generate a draft" variant="primary" href={ROUTES.resume} />}
        />
      ) : (
        <GridSystem gap={4} align="start">
          <GridColumn span="full" lg={5}>
            <SectionCard title="Drafts" description="Newest first. Each Generate adds one.">
              <GenerationHistory
                history={history}
                selectedId={selected?.id ?? null}
                onView={setSelectedId}
              />
            </SectionCard>
          </GridColumn>
          <GridColumn span="full" lg={7}>
            <Stack gap={3}>
              <ResumePreview account={account} profile={profile} resume={selected} />
              {selected && !isSampleHistory ? (
                <Button
                  label="Delete this draft"
                  variant="secondary"
                  icon={<Glyph name="trash" />}
                  onClick={() => remove(selected.id)}
                />
              ) : null}
            </Stack>
          </GridColumn>
        </GridSystem>
      )}
    </Stack>
  );
}
