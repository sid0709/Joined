"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Drawer,
  GridColumn,
  GridSystem,
  HStack,
  MetadataList,
  MetadataListItem,
  Skeleton,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@openseat/design-system";
import { adminFetch, adminSend } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { TEMP_JOBS_PATH, tempJobPatchFrom, type TempJob, type TempJobPatch } from "@/lib/jobs";

const DRAWER_SIZE = "lg";
const LOADING_HEIGHT = 160;

/** Correct a scraped listing. Saves also update its public job when one exists. */
export function JobDetailDrawer({
  jobId,
  onClose,
  onSaved,
}: {
  jobId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  return <JobDetail key={jobId} jobId={jobId} onClose={onClose} onSaved={onSaved} />;
}

function JobDetail({
  jobId,
  onClose,
  onSaved,
}: {
  jobId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [job, setJob] = useState<TempJob | null>(null);
  const [draft, setDraft] = useState<TempJobPatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const path = `${TEMP_JOBS_PATH}/${encodeURIComponent(jobId)}`;

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<{ job: TempJob }>(path, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setJob(body.job);
        setDraft(tempJobPatchFrom(body.job));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load job");
        }
      });
    return () => controller.abort();
  }, [path]);

  const set =
    <K extends keyof TempJobPatch>(key: K) =>
    (value: TempJobPatch[K]) => {
      setSaved(false);
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    };

  async function save() {
    if (!draft) return;
    setSaveError(null);
    try {
      const body = await adminSend<{ job: TempJob }>(path, "PATCH", draft);
      setJob(body.job);
      setDraft(tempJobPatchFrom(body.job));
      setSaved(true);
      onSaved?.();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save job");
    }
  }

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={draft?.title || (error ? "Job" : "Loading job")}
      subtitle="Temp job"
      size={DRAWER_SIZE}
      purpose="form"
      footer={
        <HStack gap={2} hAlign="end">
          <Button label="Close" variant="ghost" clickAction={onClose} />
          <Button label="Save listing" variant="primary" clickAction={save} isDisabled={!draft} />
        </HStack>
      }
    >
      <Stack gap={5}>
        {error ? <Banner status="error" title={error} /> : null}
        {saveError ? <Banner status="error" title={saveError} /> : null}
        {saved ? (
          <Banner
            status="success"
            title="Listing saved"
            description="If it was already analyzed, the public job was updated too."
          />
        ) : null}
        {!draft && !error ? <Skeleton width="100%" height={LOADING_HEIGHT} /> : null}
        {draft && job ? (
          <Stack gap={5}>
            <Text type="supporting" color="secondary" display="block">
              Fix what the scrape missed. Location, workplace, level, employment, and pay update the
              public job when one exists; summary, skills, and bullets are edited on Jobs.
            </Text>
            <GridSystem gap={4}>
              <GridColumn span="full">
                <TextInput label="Title" value={draft.title} onChange={set("title")} />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput
                  label="Company"
                  value={draft.companyName}
                  onChange={set("companyName")}
                />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput
                  label="Company link"
                  value={draft.companyLink}
                  onChange={set("companyLink")}
                />
              </GridColumn>
              <GridColumn span="full">
                <TextInput
                  label="Logo URL"
                  value={draft.companyLogo}
                  onChange={set("companyLogo")}
                />
              </GridColumn>
              <GridColumn span="full">
                <TextInput label="Apply link" value={draft.applyLink} onChange={set("applyLink")} />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput label="Location" value={draft.location} onChange={set("location")} />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput
                  label="Workplace"
                  value={draft.remote}
                  onChange={set("remote")}
                  placeholder="Remote, hybrid, or onsite"
                />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput
                  label="Level"
                  value={draft.seniority}
                  onChange={set("seniority")}
                  placeholder="Senior, staff, manager"
                />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput
                  label="Employment"
                  value={draft.time}
                  onChange={set("time")}
                  placeholder="Full-time, contract, part-time"
                />
              </GridColumn>
              <GridColumn span="full">
                <TextInput
                  label="Salary"
                  value={draft.salary}
                  onChange={set("salary")}
                  placeholder="$120K - $150K a year"
                />
              </GridColumn>
            </GridSystem>
            <TextArea label="Description" value={draft.description} onChange={set("description")} />
            <MetadataList columns={2}>
              <MetadataListItem label="Review">{job.titleReviewLabel || "—"}</MetadataListItem>
              <MetadataListItem label="Source">
                {[job.sourceCatalog, job.source].filter(Boolean).join(" · ") || "—"}
              </MetadataListItem>
              <MetadataListItem label="Created by">{job.createdBy || "—"}</MetadataListItem>
              <MetadataListItem label="Posted">{formatDate(job.postedAt)}</MetadataListItem>
              <MetadataListItem label="Updated">{formatDate(job.updatedAt)}</MetadataListItem>
            </MetadataList>
            {job.aiSkills?.length ? (
              <Stack gap={2}>
                <Text weight="semibold">Extracted skills</Text>
                <HStack gap={1.5} wrap="wrap">
                  {job.aiSkills.map((skill) => (
                    <Badge
                      key={`${skill.name}-${skill.category}`}
                      label={`${skill.name ?? ""}${skill.requirement != null ? ` ${skill.requirement}` : ""}`}
                      variant="neutral"
                    />
                  ))}
                </HStack>
              </Stack>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Drawer>
  );
}
