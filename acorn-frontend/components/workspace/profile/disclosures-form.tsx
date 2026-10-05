import { FormLayout, SectionCard, Selector } from "sid-ui";
import {
  DISABILITY_OPTIONS,
  HISPANIC_OPTIONS,
  RACE_OPTIONS,
  VETERAN_OPTIONS,
  type ApplicantProfile,
  type SetProfileField,
} from "@/lib/workspace/profile";

/** Voluntary self-identification: ethnicity, race, disability, and veteran status. */
export function DisclosuresForm({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: SetProfileField;
}) {
  return (
    <SectionCard
      title="Voluntary disclosures"
      description="Equal-opportunity questions. Each has a decline option."
    >
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
