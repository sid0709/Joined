"use client";

import { useMemo, useState } from "react";
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
} from "@joined/design-system";
import { FormDialog } from "@/components/form-dialog";
import { StatGrid } from "@/components/stat-card";
import type { Application } from "@/lib/applications";
import type { Profile } from "@/lib/profile";
import {
  MAX_RESUME_BYTES,
  PROFILE_RESUME_ID,
  PROFILE_RESUME_LABEL,
  RESUME_ACCEPT,
  RESUME_LABEL_MAX_LENGTH,
  countResumeUses,
  defaultResume,
  isProfileResume,
  newResumeFromFile,
  profileResume,
  readyResumes,
  resumeExport,
  type Resume,
} from "@/lib/resumes";
import { ResumeBuilder } from "./resume-builder";
import { ResumeCard, type ResumeAction } from "./resume-card";
import { ResumeInsights } from "./resume-insights";

const CARD_MIN_WIDTH = 220;
const PERCENT = 100;

const keepFile: UploadHandler = async (_file, onProgress) => {
  onProgress(PERCENT);
};

function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

/** Resume library plus the structured builder saved on the seeker profile. */
export function ResumesWorkspace({
  initialProfile,
  applications = [],
}: {
  initialProfile: Profile;
  applications?: Pick<Application, "resume">[];
}) {
  const toast = useToast();
  const usedIn = countResumeUses(applications, PROFILE_RESUME_LABEL);
  const [profile, setProfile] = useState(initialProfile);
  const [resumes, setResumes] = useState<Resume[]>([profileResume(initialProfile, usedIn)]);
  const [selectedId, setSelectedId] = useState<string | undefined>(PROFILE_RESUME_ID);
  const [renaming, setRenaming] = useState<Resume | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [deleting, setDeleting] = useState<Resume | null>(null);

  const selected = resumes.find((resume) => resume.id === selectedId) ?? resumes[0];
  const parsed = readyResumes(resumes);
  const best = parsed.reduce<Resume | undefined>(
    (top, resume) => (!top || resume.score > top.score ? resume : top),
    undefined,
  );

  const refreshProfile = (next: Profile) => {
    setProfile(next);
    setResumes((current) =>
      current.map((resume) =>
        isProfileResume(resume.id)
          ? { ...profileResume(next, resume.usedIn), isDefault: resume.isDefault }
          : resume,
      ),
    );
  };

  const update = (id: string, patch: Partial<Resume>) =>
    setResumes((current) =>
      current.map((resume) => (resume.id === id ? { ...resume, ...patch } : resume)),
    );

  const setDefault = (resume: Resume) => {
    setResumes((current) => current.map((item) => ({ ...item, isDefault: item.id === resume.id })));
    toast({ body: `${resume.label} is now your default resume` });
  };

  const download = (resume: Resume) => {
    if (resume.file) {
      const url = URL.createObjectURL(resume.file);
      downloadUrl(url, resume.fileName);
      URL.revokeObjectURL(url);
      return;
    }
    if (isProfileResume(resume.id)) {
      const exported = resumeExport(profile);
      const url = URL.createObjectURL(new Blob([exported.text], { type: exported.type }));
      downloadUrl(url, exported.filename);
      URL.revokeObjectURL(url);
      return;
    }
    toast({ body: `Couldn’t download ${resume.fileName}`, type: "error" });
  };

  const act = (resume: Resume, action: ResumeAction) => {
    switch (action) {
      case "default":
        setDefault(resume);
        return;
      case "download":
        download(resume);
        return;
      case "delete":
        setDeleting(resume);
        return;
      case "rename":
        setDraftLabel(resume.label);
        setRenaming(resume);
        return;
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  };

  const addFiles = (files: File[]) => {
    const added = files
      .map(newResumeFromFile)
      .filter((resume) => !resumes.some((item) => item.id === resume.id));
    if (added.length === 0) return;
    setResumes((current) => [...current, ...added]);
    setSelectedId(added[0].id);
    toast({ body: added.length === 1 ? `${added[0].label} added` : `${added.length} files added` });
  };

  const applicationsSent = useMemo(
    () => resumes.reduce((sum, resume) => sum + resume.usedIn, 0),
    [resumes],
  );

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
            value: defaultResume(resumes)?.label ?? "None",
            hint: "Sent with direct applications",
          },
          {
            label: "Completeness",
            value: best ? `${best.score}` : "—",
            hint: best ? best.label : "Add résumé details to score it",
          },
          {
            label: "Applications sent",
            value: String(applicationsSent),
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
                label="Upload a file for this visit"
                description="PDF works best. Files stay in this browser until you leave — structured résumé details save below."
                accept={RESUME_ACCEPT}
                maxSize={MAX_RESUME_BYTES}
                upload={keepFile}
                onChange={addFiles}
              />
            </Card>
            <ResumeBuilder profile={profile} onSaved={refreshProfile} />
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          {selected ? (
            <ResumeInsights
              resume={selected}
              profile={isProfileResume(selected.id) ? profile : undefined}
              onSetDefault={() => setDefault(selected)}
              onDownload={() => download(selected)}
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
          if (!deleting || isProfileResume(deleting.id)) return;
          setResumes((current) => current.filter((resume) => resume.id !== deleting.id));
          if (selectedId === deleting.id) setSelectedId(PROFILE_RESUME_ID);
          toast({ body: `Deleted ${deleting.label}` });
          setDeleting(null);
        }}
      />
    </Stack>
  );
}
