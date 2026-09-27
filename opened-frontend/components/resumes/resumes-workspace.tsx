"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  Card,
  FileUploader,
  Grid,
  GridColumn,
  GridSystem,
  Stack,
  TextInput,
  useToast,
  type UploadHandler,
} from "@openseat/design-system";
import { FormDialog } from "@/components/form-dialog";
import { StatGrid } from "@/components/stat-card";
import {
  MAX_RESUME_BYTES,
  PARSE_DELAY_MS,
  RESUME_ACCEPT,
  RESUME_LABEL_MAX_LENGTH,
  RESUMES,
  newResumeFromFile,
  parsedResume,
  type Resume,
} from "@/lib/resumes";
import { ResumeCard, type ResumeAction } from "./resume-card";
import { ResumeInsights } from "./resume-insights";

const CARD_MIN_WIDTH = 220;
const UPLOAD_STEPS = 5;
const UPLOAD_STEP_MS = 180;
const PERCENT = 100;

/** Pretends to upload in a few steps so progress is visible. */
const demoUpload: UploadHandler = async (_file, onProgress) => {
  for (let step = 1; step <= UPLOAD_STEPS; step += 1) {
    await new Promise((resolve) => setTimeout(resolve, UPLOAD_STEP_MS));
    onProgress((step / UPLOAD_STEPS) * PERCENT);
  }
};

/** Resume library: versions as cards, insights for the selected one, and uploads. */
export function ResumesWorkspace() {
  const toast = useToast();
  const [resumes, setResumes] = useState(RESUMES);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    RESUMES.find((resume) => resume.isDefault)?.id ?? RESUMES[0]?.id,
  );
  const [renaming, setRenaming] = useState<Resume | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [deleting, setDeleting] = useState<Resume | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const selected = resumes.find((resume) => resume.id === selectedId) ?? resumes[0];
  const parsed = resumes.filter((resume) => resume.parse === "parsed");
  const best = parsed.reduce<Resume | undefined>(
    (top, resume) => (!top || resume.score > top.score ? resume : top),
    undefined,
  );
  const update = (id: string, patch: Partial<Resume>) =>
    setResumes((current) =>
      current.map((resume) => (resume.id === id ? { ...resume, ...patch } : resume)),
    );

  const setDefault = (resume: Resume) => {
    setResumes((current) => current.map((item) => ({ ...item, isDefault: item.id === resume.id })));
    toast({ body: `${resume.label} is now your default resume` });
  };

  const act = (resume: Resume, action: ResumeAction) => {
    if (action === "default") setDefault(resume);
    if (action === "download") toast({ body: `Downloading ${resume.fileName}` });
    if (action === "delete") setDeleting(resume);
    if (action === "rename") {
      setDraftLabel(resume.label);
      setRenaming(resume);
    }
  };

  const addFiles = (files: File[]) => {
    const added = files
      .map(newResumeFromFile)
      .filter((resume) => !resumes.some((item) => item.id === resume.id));
    if (added.length === 0) return;
    setResumes((current) => [...current, ...added]);
    setSelectedId(added[0].id);
    added.forEach((resume) => {
      const timer = window.setTimeout(() => {
        setResumes((current) =>
          current.map((item) => (item.id === resume.id ? parsedResume(item) : item)),
        );
        toast({ body: `${resume.label} is ready` });
      }, PARSE_DELAY_MS);
      timers.current.push(timer);
    });
  };

  return (
    <Stack gap={6}>
      <StatGrid
        stats={[
          {
            label: "Versions",
            value: String(resumes.length),
            hint: `${parsed.length} ready to send`,
          },
          {
            label: "Default",
            value: resumes.find((resume) => resume.isDefault)?.label ?? "None",
            hint: "Sent with direct applications",
          },
          {
            label: "Best readability",
            value: best ? `${best.score}` : "—",
            hint: best ? best.label : "Upload a resume to score it",
          },
          {
            label: "Applications sent",
            value: String(resumes.reduce((sum, resume) => sum + resume.usedIn, 0)),
            hint: "Across all versions",
          },
        ]}
      />

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={6}>
            <Grid columns={{ minWidth: CARD_MIN_WIDTH }} gap={4}>
              {resumes.map((resume) => (
                <ResumeCard
                  key={resume.id}
                  resume={resume}
                  isSelected={resume.id === selected?.id}
                  onSelect={() => setSelectedId(resume.id)}
                  onAction={(action) => act(resume, action)}
                />
              ))}
            </Grid>
            <Card padding={5}>
              <FileUploader
                label="Upload a new version"
                description="PDF works best. DOCX is fine too — we keep the file even if parsing fails."
                accept={RESUME_ACCEPT}
                maxSize={MAX_RESUME_BYTES}
                upload={demoUpload}
                onChange={addFiles}
              />
            </Card>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          {selected ? (
            <ResumeInsights
              resume={selected}
              onSetDefault={() => setDefault(selected)}
              onDownload={() => toast({ body: `Downloading ${selected.fileName}` })}
            />
          ) : null}
        </GridColumn>
      </GridSystem>

      <FormDialog
        isOpen={renaming != null}
        onOpenChange={(open) => (open ? null : setRenaming(null))}
        title="Rename resume"
        subtitle="Only you see this label."
        submitLabel="Save"
        isSubmitDisabled={!draftLabel.trim()}
        onSubmit={() => {
          if (renaming) update(renaming.id, { label: draftLabel.trim() });
          setRenaming(null);
        }}
      >
        <TextInput
          label="Label"
          value={draftLabel}
          onChange={(value) => setDraftLabel(value.slice(0, RESUME_LABEL_MAX_LENGTH))}
          description={`Up to ${RESUME_LABEL_MAX_LENGTH} characters, like “Design-focused”.`}
        />
      </FormDialog>

      <AlertDialog
        isOpen={deleting != null}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        title={`Delete “${deleting?.label ?? ""}”?`}
        description="Applications you already sent keep their copy. This can’t be undone."
        actionLabel="Delete"
        actionVariant="destructive"
        onAction={() => {
          if (!deleting) return;
          setResumes((current) => current.filter((resume) => resume.id !== deleting.id));
          if (selectedId === deleting.id)
            setSelectedId(resumes.find((resume) => resume.isDefault)?.id);
          toast({ body: `Deleted ${deleting.label}` });
          setDeleting(null);
        }}
      />
    </Stack>
  );
}
