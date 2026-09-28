"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Dialog,
  DialogHeader,
  FormLayout,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  RadioList,
  RadioListItem,
  Switch,
  TextArea,
} from "@openseat/design-system";
import { companyBySlug, jobHasLogoFile, type Job } from "@/lib/jobs";
import { createApplication } from "@/lib/me/pipeline";
import { RESUMES } from "@/lib/resumes";
import { CompanyLogo } from "./company-logo";

const DIALOG_WIDTH = 560;
const NOTE_MAX_LENGTH = 500;
const NOTE_ROWS = 4;

/** Only resumes the parser could read can go out with an application. */
const READY_RESUMES = RESUMES.filter((resume) => resume.parse === "parsed");
const DEFAULT_RESUME_ID =
  (READY_RESUMES.find((resume) => resume.isDefault) ?? READY_RESUMES[0])?.id ?? "";

type Props = {
  job: Job | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (job: Job) => void;
};

/** Apply to a direct job with a chosen resume, an optional note, and the profile. */
export function ApplyDialog({ job, onOpenChange, onSubmitted }: Props) {
  const [resumeId, setResumeId] = useState(DEFAULT_RESUME_ID);
  const [note, setNote] = useState("");
  const [shareProfile, setShareProfile] = useState(true);
  const company = job ? companyBySlug(job.companyId) : undefined;

  const close = () => {
    onOpenChange(false);
    setNote("");
  };

  const submit = async () => {
    if (!job) return;
    const resume = READY_RESUMES.find((item) => item.id === resumeId);
    await createApplication({
      jobId: job.id,
      resume: resume?.label,
      note,
    });
    onSubmitted(job);
    close();
  };

  return (
    <Dialog
      isOpen={job !== null}
      onOpenChange={(open) => (open ? undefined : close())}
      purpose="form"
      width={DIALOG_WIDTH}
    >
      {job ? (
        <Layout
          height="auto"
          header={
            <DialogHeader
              title={`Apply to ${job.title}`}
              subtitle={`${job.company} · ${job.location}`}
              startContent={
                <CompanyLogo
                  name={job.company}
                  companyId={job.companyId}
                  src={job.companyLogo}
                  hasFile={jobHasLogoFile(job)}
                  size={40}
                />
              }
              onOpenChange={(open) => (open ? undefined : close())}
              hasDivider
            />
          }
          content={
            <LayoutContent>
              <FormLayout>
                <RadioList label="Resume" value={resumeId} onChange={setResumeId}>
                  {READY_RESUMES.map((resume) => (
                    <RadioListItem
                      key={resume.id}
                      value={resume.id}
                      label={resume.label}
                      description={`${resume.fileName} · Readability ${resume.score}/100`}
                      endContent={
                        resume.isDefault ? <Badge label="Default" variant="neutral" /> : undefined
                      }
                    />
                  ))}
                </RadioList>
                <TextArea
                  label="Note to the hiring team"
                  isOptional
                  rows={NOTE_ROWS}
                  value={note}
                  onChange={(value) => setNote(value.slice(0, NOTE_MAX_LENGTH))}
                  placeholder="Why this role, in two or three sentences."
                  description={`${note.length}/${NOTE_MAX_LENGTH}`}
                />
                <Switch
                  label="Share my Opened profile"
                  description="Target roles, experience, and verification badge."
                  value={shareProfile}
                  onChange={setShareProfile}
                  labelPosition="start"
                  labelSpacing="spread"
                />
                {company ? (
                  <Banner
                    status="info"
                    title={`${company.name} usually replies within ${company.replyDays} days.`}
                    description="You’ll see every status change in My applications."
                  />
                ) : null}
              </FormLayout>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="Cancel" variant="ghost" onClick={close} />
                <Button
                  label="Submit application"
                  variant="primary"
                  clickAction={submit}
                  isDisabled={!resumeId}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      ) : null}
    </Dialog>
  );
}
