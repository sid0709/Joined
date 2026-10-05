"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  CheckboxInput,
  Dialog,
  DialogHeader,
  FormLayout,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  RadioList,
  RadioListItem,
  Selector,
  Stack,
  Switch,
  Text,
  TextArea,
  TextInput,
} from "@joined/design-system";
import { companyBySlug, jobHasLogoFile, type Job } from "@/lib/jobs";
import {
  APPLY_CONSENT_LABEL,
  APPLY_CONSENT_VERSION,
  REFERRAL_OPTIONS,
  evaluateAnswer,
  hydrateScreeningQuestions,
  type ScreeningAnswer,
} from "@/lib/intake";
import { createApplication, fetchProfile } from "@/lib/me/pipeline";
import { emptyProfile } from "@/lib/profile";
import { PROFILE_RESUME_ID, profileResume, readyResumes } from "@/lib/resumes";
import { CompanyLogo } from "./company-logo";

const DIALOG_WIDTH = 560;
const NOTE_MAX_LENGTH = 500;
const NOTE_ROWS = 4;

const FALLBACK_RESUME = profileResume(emptyProfile());

type Props = {
  job: Job | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (job: Job) => void;
};

/** Apply to a direct job with resume, screening answers, consent, and referral. */
export function ApplyDialog({ job, onOpenChange, onSubmitted }: Props) {
  const [resumeId, setResumeId] = useState(PROFILE_RESUME_ID);
  const [resumes, setResumes] = useState(() => [FALLBACK_RESUME]);
  const [note, setNote] = useState("");
  const [shareProfile, setShareProfile] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [referralSource, setReferralSource] = useState("");
  const [consent, setConsent] = useState(false);
  const company = job ? companyBySlug(job.companyId) : undefined;
  const questions = useMemo(
    () => hydrateScreeningQuestions(job?.screeningQuestions),
    [job?.screeningQuestions],
  );
  const sendable = readyResumes(resumes);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    fetchProfile()
      .then((loaded) => {
        if (cancelled) return;
        const resume = profileResume(loaded);
        setResumes([resume]);
        setResumeId(resume.id);
      })
      .catch(() => {
        if (cancelled) return;
        setResumes([FALLBACK_RESUME]);
        setResumeId(PROFILE_RESUME_ID);
      });
    return () => {
      cancelled = true;
    };
  }, [job]);

  const close = () => {
    onOpenChange(false);
    setNote("");
    setAnswers({});
    setConsent(false);
    setReferralSource("");
  };

  const missingRequired = questions.some(
    (question) => question.required && !(answers[question.id] ?? "").trim(),
  );
  const canSubmit = Boolean(resumeId) && consent && !missingRequired;

  const submit = async () => {
    if (!job || !canSubmit) return;
    const resume = sendable.find((item) => item.id === resumeId);
    const screeningAnswers: ScreeningAnswer[] = questions.map((question) =>
      evaluateAnswer(question, answers[question.id] ?? ""),
    );
    await createApplication({
      jobId: job.id,
      resume: resume?.label,
      note,
      screeningAnswers,
      referralSource: referralSource || undefined,
      consentAt: new Date().toISOString(),
      consentVersion: APPLY_CONSENT_VERSION,
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
                  {sendable.map((resume) => (
                    <RadioListItem
                      key={resume.id}
                      value={resume.id}
                      label={resume.label}
                      description={`${resume.fileName} · Completeness ${resume.score}/100`}
                      endContent={
                        resume.isDefault ? <Badge label="Default" variant="neutral" /> : undefined
                      }
                    />
                  ))}
                </RadioList>

                {questions.length > 0 ? (
                  <Stack gap={3}>
                    <Text type="label">Screening questions</Text>
                    {questions.map((question) =>
                      question.kind === "yes_no" ? (
                        <Selector
                          key={question.id}
                          label={question.prompt}
                          options={[
                            { value: "", label: "Select an answer" },
                            { value: "yes", label: "Yes" },
                            { value: "no", label: "No" },
                          ]}
                          value={answers[question.id] ?? ""}
                          onChange={(value) =>
                            setAnswers((current) => ({ ...current, [question.id]: value }))
                          }
                          isRequired={question.required}
                        />
                      ) : (
                        <TextInput
                          key={question.id}
                          label={question.prompt}
                          value={answers[question.id] ?? ""}
                          onChange={(value) =>
                            setAnswers((current) => ({ ...current, [question.id]: value }))
                          }
                          isRequired={question.required}
                        />
                      ),
                    )}
                  </Stack>
                ) : null}

                <TextArea
                  label="Note to the hiring team"
                  isOptional
                  rows={NOTE_ROWS}
                  value={note}
                  onChange={(value) => setNote(value.slice(0, NOTE_MAX_LENGTH))}
                  placeholder="Why this role, in two or three sentences."
                  description={`${note.length}/${NOTE_MAX_LENGTH}`}
                />

                <Selector
                  label="How did you hear about this role?"
                  isOptional
                  options={REFERRAL_OPTIONS}
                  value={referralSource}
                  onChange={setReferralSource}
                />

                <Switch
                  label="Share my Joined profile"
                  description="Target roles, experience, and verification badge."
                  value={shareProfile}
                  onChange={setShareProfile}
                  labelPosition="start"
                  labelSpacing="spread"
                />

                <CheckboxInput label={APPLY_CONSENT_LABEL} value={consent} onChange={setConsent} />

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
                  isDisabled={!canSubmit}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      ) : null}
    </Dialog>
  );
}
