"use client";

import { FileUploader, useToast, type UploadHandler } from "sid-ui";
import { fillProfileFromResume } from "@/lib/me/pipeline";
import type { Profile } from "@/lib/profile";
import { MAX_RESUME_BYTES, RESUME_ACCEPT, RESUME_FILLED_MESSAGE } from "@/lib/resumes";

/** Shown while the API reads the file; the read has no progress of its own. */
const READING_PERCENT = 50;
const DONE_PERCENT = 100;

/** Upload a résumé and fill the profile with what it says. */
export function ResumeAutofill({
  onFilled,
  onFiles,
  variant = "dropzone",
}: {
  onFilled: (profile: Profile) => void;
  /** Files that filled the profile, for callers that keep them for this visit. */
  onFiles?: (files: File[]) => void;
  variant?: "dropzone" | "compact";
}) {
  const toast = useToast();

  const upload: UploadHandler = async (file, onProgress) => {
    onProgress(READING_PERCENT);
    const { profile, reader } = await fillProfileFromResume(file);
    onProgress(DONE_PERCENT);
    onFilled(profile);
    toast({ body: RESUME_FILLED_MESSAGE[reader] });
  };

  return (
    <FileUploader
      label="Fill your profile from a résumé"
      description="PDF or Word (.docx). We read your name, contact, summary, skills, experience, and education. Anything the résumé leaves out stays as it is."
      accept={RESUME_ACCEPT}
      maxSize={MAX_RESUME_BYTES}
      upload={upload}
      onChange={onFiles}
      variant={variant}
    />
  );
}
