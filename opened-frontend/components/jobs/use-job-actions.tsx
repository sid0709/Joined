"use client";

import { useState } from "react";
import { Button, useToast } from "@openseat/design-system";
import type { Job } from "@/lib/jobs";
import { createApplication } from "@/lib/me/pipeline";
import { signInHref } from "@/lib/routes";
import { ApplyDialog } from "./apply-dialog";

type Options = {
  isSaved: (id: string) => boolean;
  toggleSave: (id: string) => void;
  markApplied: (id: string) => void;
  signedIn: boolean;
  hide?: (id: string) => void;
  unhide?: (id: string) => void;
};

/**
 * Apply, save, share, and hide — each with feedback and an undo where it
 * matters. Returns the apply dialog to render once per page.
 */
export function useJobActions({
  isSaved,
  toggleSave,
  markApplied,
  signedIn,
  hide,
  unhide,
}: Options) {
  const toast = useToast();
  const [applying, setApplying] = useState<Job | null>(null);

  const needAccount = () => {
    window.location.assign(signInHref(window.location.pathname));
  };

  const apply = (job: Job) => {
    if (!signedIn) {
      needAccount();
      return;
    }
    const listing = jobLink(job);
    if (listing) {
      window.open(listing, "_blank", "noopener,noreferrer");
      toast({
        body: `Opened the listing for ${job.title}. Mark it applied when you’re done.`,
        endContent: (
          <Button
            label="I applied"
            size="sm"
            variant="ghost"
            onClick={() => void recordExternal(job)}
          />
        ),
      });
      return;
    }
    if (job.source === "direct") {
      setApplying(job);
      return;
    }
    toast({ body: "This listing has no application link.", type: "error" });
  };

  const recordExternal = async (job: Job) => {
    try {
      await createApplication({ jobId: job.id });
      markApplied(job.id);
      toast({ body: `Application sent to ${job.company}. Track it in My applications.` });
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "Could not record the application.",
        type: "error",
      });
    }
  };

  const save = (job: Job) => {
    if (!signedIn) {
      needAccount();
      return;
    }
    const wasSaved = isSaved(job.id);
    toggleSave(job.id);
    toast({
      body: wasSaved
        ? `Removed ${job.title} from saved jobs.`
        : `Saved ${job.title}. Find it under Saved.`,
      endContent: (
        <Button label="Undo" size="sm" variant="ghost" onClick={() => toggleSave(job.id)} />
      ),
    });
  };

  const share = async (job: Job) => {
    const listing = jobLink(job);
    if (!listing) {
      toast({ body: "This listing has no application link.", type: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(listing);
      toast({ body: "Job link copied." });
    } catch {
      toast({ body: "Couldn’t copy the job link.", type: "error" });
    }
  };

  const dismiss = hide
    ? (job: Job) => {
        hide(job.id);
        toast({
          body: `Hidden ${job.title} at ${job.company}. We’ll show fewer jobs like it.`,
          endContent: unhide ? (
            <Button label="Undo" size="sm" variant="ghost" onClick={() => unhide(job.id)} />
          ) : undefined,
        });
      }
    : undefined;

  const dialog = (
    <ApplyDialog
      job={applying}
      onOpenChange={(open) => (open ? undefined : setApplying(null))}
      onSubmitted={(job) => {
        markApplied(job.id);
        toast({ body: `Application sent to ${job.company}. Track it in My applications.` });
      }}
    />
  );

  return { apply, save, share, dismiss, dialog };
}

export type JobActions = ReturnType<typeof useJobActions>;

function jobLink(job: Job) {
  const link = job.applyLink?.trim();
  return link ? link : null;
}
