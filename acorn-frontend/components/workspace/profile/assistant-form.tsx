import { FormLayout, Grid, SectionCard, Selector, Stack, TextInput } from "sid-ui";
import {
  MODEL_OPTIONS,
  PATH_MAX,
  PROVIDER_OPTIONS,
  SALARY_MAX,
  SECRET_MAX,
  type ApplicantProfile,
  type SetProfileField,
} from "@/lib/workspace/profile";
import { PAIR_WIDTH } from "./form-layout";

/** Salary, keys, the résumé folder, and the model Acorn writes with. */
export function AssistantForm({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: SetProfileField;
}) {
  return (
    <Stack gap={4}>
      <JobBid profile={profile} onChange={onChange} />
      <ModelChoice profile={profile} onChange={onChange} />
    </Stack>
  );
}

function JobBid({ profile, onChange }: { profile: ApplicantProfile; onChange: SetProfileField }) {
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
  onChange: SetProfileField;
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
