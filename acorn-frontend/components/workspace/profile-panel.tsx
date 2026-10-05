"use client";

import { useRef, useState } from "react";
import {
  Banner,
  Button,
  FileUploader,
  FormLayout,
  Grid,
  GridColumn,
  GridSystem,
  PageHeader,
  SectionCard,
  Selector,
  Stack,
  StateSelector,
  TextInput,
} from "@joined/design-system";
import type { AcornAccount } from "@/lib/auth/session";
import { PHONE_MAX, type LibraryResume } from "@/lib/workspace/model";
import {
  MIN_RESUME_TEXT,
  RESUME_ACCEPT,
  RESUME_MAX_BYTES,
  profileFromResumeText,
  readResumeFile,
} from "@/lib/workspace/resume-file";
import {
  ADDRESS_MAX,
  AGE_MAX,
  CITIZENSHIP_OPTIONS,
  COUNTRY_OPTIONS,
  DISABILITY_OPTIONS,
  GENDER_OPTIONS,
  HISPANIC_OPTIONS,
  LINK_MAX,
  MODEL_OPTIONS,
  ORIENTATION_OPTIONS,
  PATH_MAX,
  PRONOUN_OPTIONS,
  PROVIDER_OPTIONS,
  RACE_OPTIONS,
  SALARY_MAX,
  SECRET_MAX,
  VETERAN_OPTIONS,
  VISA_OPTIONS,
  sampleProfile,
  type ApplicantProfile,
} from "@/lib/workspace/profile";
import { useWorkspace } from "./use-workspace";
import { ProfileTimeline } from "./profile-timeline";

const PAIR_WIDTH = 140;

export function ProfilePanel({ account }: { account: AcornAccount }) {
  const { workspace, update } = useWorkspace();
  const base = workspace.profile ?? sampleProfile(account);
  const [draft, setDraft] = useState<ApplicantProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [uploadError, setUploadError] = useState("");
  const seenUpload = useRef("");
  const profile = draft ?? base;

  const fillFromUpload = async (file: File | undefined) => {
    if (!file) return;
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seenUpload.current === key) return;
    seenUpload.current = key;
    setUploadError("");
    setUploadNote("");
    const text = await readResumeFile(file);
    if (text.trim().length < MIN_RESUME_TEXT) {
      setUploadError(
        "Couldn't read text from that file. Use a PDF with selectable text, or a .txt file.",
      );
      return;
    }
    const next = profileFromResumeText(text, profile);
    const item: LibraryResume = {
      id: crypto.randomUUID(),
      name: file.name,
      source: "upload",
      detail: "Uploaded résumé",
      addedAt: new Date().toISOString(),
    };
    setDraft(next);
    update({ ...workspace, profile: next, library: [item, ...workspace.library].slice(0, 20) });
    setUploadNote(`Filled the profile from ${file.name}.`);
    setSaved(false);
  };

  const set = <K extends keyof ApplicantProfile>(key: K, value: ApplicantProfile[K]) => {
    setDraft({ ...profile, [key]: value });
    setSaved(false);
  };

  const save = () => {
    update({ ...workspace, profile });
    setDraft(null);
    setSaved(true);
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Profile"
        description="Identity, disclosures, and the career timeline Acorn types into applications."
        action={<Button label="Save profile" variant="primary" onClick={save} />}
      />
      {saved ? <Banner status="success" title="Profile saved on this browser." /> : null}
      {uploadNote ? <Banner status="success" title={uploadNote} /> : null}
      {uploadError ? <Banner status="error" title={uploadError} /> : null}
      <SectionCard
        title="Upload résumé"
        description="Drop a PDF or text résumé. Acorn fills your name, contact, links, and career timeline from it."
      >
        <FileUploader
          label="Résumé file"
          accept={RESUME_ACCEPT}
          isMultiple={false}
          maxFiles={1}
          maxSize={RESUME_MAX_BYTES}
          onChange={(files) => {
            void fillFromUpload(files[0]);
          }}
        />
      </SectionCard>
      <GridSystem gap={4} align="start">
        <GridColumn span="full" lg={4}>
          <Identity profile={profile} onChange={set} />
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Stack gap={4}>
            <Disclosures profile={profile} onChange={set} />
            <JobBid profile={profile} onChange={set} />
            <ModelChoice profile={profile} onChange={set} />
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <ProfileTimeline profile={profile} onChange={setDraft} />
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}

function Identity({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: <K extends keyof ApplicantProfile>(key: K, value: ApplicantProfile[K]) => void;
}) {
  return (
    <SectionCard title="Identity" description="Name, contact, location, and links.">
      <FormLayout>
        <TextInput
          label="Full name"
          value={profile.fullName}
          onChange={(value) => onChange("fullName", value)}
        />
        <Grid columns={{ minWidth: PAIR_WIDTH }} gap={3}>
          <TextInput
            label="First name"
            value={profile.firstName}
            onChange={(value) => onChange("firstName", value)}
          />
          <TextInput
            label="Last name"
            value={profile.lastName}
            onChange={(value) => onChange("lastName", value)}
          />
          <TextInput
            label="Age"
            value={profile.age}
            onChange={(value) => onChange("age", value.replace(/\D/g, "").slice(0, AGE_MAX))}
          />
          <Selector
            label="Gender"
            options={GENDER_OPTIONS}
            value={profile.gender}
            onChange={(value) => onChange("gender", value)}
          />
          <Selector
            label="Pronouns"
            options={PRONOUN_OPTIONS}
            value={profile.pronouns}
            onChange={(value) => onChange("pronouns", value)}
          />
          <Selector
            label="Orientation"
            options={ORIENTATION_OPTIONS}
            value={profile.orientation}
            onChange={(value) => onChange("orientation", value)}
          />
        </Grid>
        <TextInput
          label="Email"
          type="email"
          value={profile.email}
          onChange={(value) => onChange("email", value)}
        />
        <TextInput
          label="Phone"
          value={profile.phone}
          onChange={(value) => onChange("phone", value.slice(0, PHONE_MAX))}
        />
        <TextInput
          label="Gmail app password"
          type="password"
          value={profile.gmailAppPassword}
          onChange={(value) => onChange("gmailAppPassword", value.slice(0, SECRET_MAX))}
          description="Lets Acorn read application mail for this mailbox."
        />
        <TextInput
          label="Street address"
          value={profile.street}
          onChange={(value) => onChange("street", value.slice(0, ADDRESS_MAX))}
        />
        <Grid columns={{ minWidth: PAIR_WIDTH }} gap={3}>
          <TextInput
            label="City"
            value={profile.city}
            onChange={(value) => onChange("city", value)}
          />
          <StateSelector
            label="State"
            value={profile.state}
            onChange={(value) => onChange("state", value)}
          />
          <Selector
            label="Citizenship"
            options={CITIZENSHIP_OPTIONS}
            value={profile.citizenship}
            onChange={(value) => onChange("citizenship", value)}
          />
          <Selector
            label="Country"
            options={COUNTRY_OPTIONS}
            value={profile.country}
            onChange={(value) => onChange("country", value)}
          />
        </Grid>
        <TextInput
          label="ZIP / postal"
          value={profile.zip}
          onChange={(value) => onChange("zip", value)}
        />
        <TextInput
          label="LinkedIn"
          value={profile.linkedin}
          onChange={(value) => onChange("linkedin", value.slice(0, LINK_MAX))}
        />
        <Grid columns={{ minWidth: PAIR_WIDTH }} gap={3}>
          <TextInput
            label="GitHub"
            value={profile.github}
            onChange={(value) => onChange("github", value.slice(0, LINK_MAX))}
          />
          <TextInput
            label="Portfolio"
            value={profile.portfolio}
            onChange={(value) => onChange("portfolio", value.slice(0, LINK_MAX))}
          />
        </Grid>
      </FormLayout>
    </SectionCard>
  );
}

function Disclosures({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: <K extends keyof ApplicantProfile>(key: K, value: ApplicantProfile[K]) => void;
}) {
  return (
    <SectionCard title="Voluntary disclosures" description="EEO and sponsorship answers.">
      <FormLayout>
        <Selector
          label="Hispanic / Latino"
          options={HISPANIC_OPTIONS}
          value={profile.hispanicLatino}
          onChange={(value) => onChange("hispanicLatino", value)}
        />
        <Selector
          label="Race / ethnicity"
          options={RACE_OPTIONS}
          value={profile.raceEthnicity}
          onChange={(value) => onChange("raceEthnicity", value)}
        />
        <Selector
          label="Visa / sponsorship"
          options={VISA_OPTIONS}
          value={profile.visaSponsorship}
          onChange={(value) => onChange("visaSponsorship", value)}
        />
        <Selector
          label="Disability"
          options={DISABILITY_OPTIONS}
          value={profile.disability}
          onChange={(value) => onChange("disability", value)}
        />
        <Selector
          label="Veteran status"
          options={VETERAN_OPTIONS}
          value={profile.veteranStatus}
          onChange={(value) => onChange("veteranStatus", value)}
        />
      </FormLayout>
    </SectionCard>
  );
}

function JobBid({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: <K extends keyof ApplicantProfile>(key: K, value: ApplicantProfile[K]) => void;
}) {
  return (
    <SectionCard title="Job bid assistant" description="Salary, API keys, and resume path.">
      <FormLayout>
        <TextInput
          label="Desired salary (annual)"
          value={profile.desiredSalary}
          onChange={(value) =>
            onChange("desiredSalary", value.replace(/\D/g, "").slice(0, SALARY_MAX))
          }
        />
        <TextInput
          label="OpenAI API key"
          type="password"
          value={profile.openaiApiKey}
          onChange={(value) => onChange("openaiApiKey", value.slice(0, SECRET_MAX))}
        />
        <TextInput
          label="DeepSeek API key"
          type="password"
          value={profile.deepseekApiKey}
          onChange={(value) => onChange("deepseekApiKey", value.slice(0, SECRET_MAX))}
        />
        <TextInput
          label="Default account password"
          type="password"
          value={profile.defaultAccountPassword}
          onChange={(value) => onChange("defaultAccountPassword", value.slice(0, SECRET_MAX))}
          description="Used when an application requires sign-up / sign-in."
        />
        <TextInput
          label="Resume folder path"
          value={profile.resumeFolderPath}
          onChange={(value) => onChange("resumeFolderPath", value.slice(0, PATH_MAX))}
        />
      </FormLayout>
    </SectionCard>
  );
}

function ModelChoice({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: <K extends keyof ApplicantProfile>(key: K, value: ApplicantProfile[K]) => void;
}) {
  return (
    <SectionCard
      title="Default AI model"
      description="Résumé generation, job-title review, skill extraction, mail, and agent work."
    >
      <FormLayout>
        <TextInput
          label="Current"
          value={`${profile.modelProvider} · ${profile.modelName}`}
          isReadOnly
        />
        <Grid columns={{ minWidth: PAIR_WIDTH }} gap={3}>
          <Selector
            label="Provider"
            options={PROVIDER_OPTIONS}
            value={profile.modelProvider}
            onChange={(value) => onChange("modelProvider", value)}
          />
          <Selector
            label="Model"
            options={MODEL_OPTIONS}
            value={profile.modelName}
            onChange={(value) => onChange("modelName", value)}
          />
        </Grid>
      </FormLayout>
    </SectionCard>
  );
}
