"use client";

import { useState } from "react";
import { Button, useToast } from "sid-ui";
import type { Job } from "@/lib/jobs";
import { jobApplyLink } from "@/lib/jobs/apply";
import { createApplication } from "@/lib/me/pipeline";
import { signInHref } from "@/lib/routes";
import { ApplyDialog } from "./apply-dialog";
import { JobReportDialog } from "./job-report-dialog";
import { MarkAppliedDialog } from "./mark-applied-dialog";
import { useAutoMarkApplied } from "./use-auto-mark-applied";

type Options = {
  isSaved: (id: string) => boolean;
  toggleSave: (id: string) => void;
  markApplied: (id: string) => void;
  /** Jobs already marked as applied never prompt again. */
  isApplied?: (id: string) => boolean;
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
  isApplied,
  signedIn,
  hide,
  unhide,
}: Options) {
  const toast = useToast();
  const [applying, setApplying] = useState<Job | null>(null);
  const [reporting, setReporting] = useState<Job | null>(null);
  const [marking, setMarking] = useState<Job | null>(null);
  const [markPending, setMarkPending] = useState(false);
  const [autoMark, setAutoMark] = useAutoMarkApplied();

  const needAccount = () => {
    window.location.assign(signInHref(window.location.pathname));
  };

  const apply = (job: Job) => {
    if (!signedIn) {
      needAccount();
      return;
    }
    const listing = jobApplyLink(job);
    if (listing) {
      window.open(listing, "_blank", "noopener,noreferrer");
      if (isApplied?.(job.id)) return;
      if (autoMark) void recordExternal(job);
      else setMarking(job);
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
      toast({ body: `Marked ${job.title} as applied. Track it in My applications.` });
      return true;
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "Could not record the application.",
        type: "error",
      });
      return false;
    }
  };

  const confirmMarked = async (job: Job, remember: boolean) => {
    setMarkPending(true);
    const marked = await recordExternal(job);
    setMarkPending(false);
    if (!marked) return;
    // Only a confirmed "Mark as applied" saves the choice; "Not now" never does.
    if (remember) setAutoMark(true);
    setMarking(null);
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
    const listing = jobApplyLink(job);
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

  const report = (job: Job) => {
    if (!signedIn) {
      needAccount();
      return;
    }
    setReporting(job);
  };

  const dialog = (
    <>
      <ApplyDialog
        job={applying}
        onOpenChange={(open) => (open ? undefined : setApplying(null))}
        onSubmitted={(job) => {
          markApplied(job.id);
          toast({ body: `Application sent to ${job.company}. Track it in My applications.` });
        }}
      />
      <MarkAppliedDialog
        key={marking?.id ?? "closed"}
        job={marking}
        pending={markPending}
        onConfirm={(job, remember) => void confirmMarked(job, remember)}
        onOpenChange={(open) => (open || markPending ? undefined : setMarking(null))}
      />
      <JobReportDialog
        key={reporting?.id ?? "closed"}
        job={reporting}
        onOpenChange={(open) => (open ? undefined : setReporting(null))}
      />
    </>
  );

  return { apply, save, share, dismiss, report, dialog };
}

export type JobActions = ReturnType<typeof useJobActions>;
