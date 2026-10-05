import { FormLayout, Grid, SectionCard, Selector } from "sid-ui";
import {
  CITIZENSHIP_OPTIONS,
  CLEARANCE_OPTIONS,
  NOTICE_OPTIONS,
  PUBLIC_TRUST_OPTIONS,
  RELOCATE_OPTIONS,
  TRAVEL_OPTIONS,
  VISA_OPTIONS,
  WORK_MODE_OPTIONS,
  YES_NO_OPTIONS,
  type ApplicantProfile,
  type SetProfileField,
} from "@/lib/workspace/profile";
import { PAIR_WIDTH } from "./form-layout";

/** The screening questions most applications ask before anything else. */
export function LogisticsForm({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: SetProfileField;
}) {
  return (
    <>
      <SectionCard
        title="Work authorization"
        description="Citizenship, the right to work, sponsorship, and clearance."
      >
        <FormLayout>
          <Grid columns={{ minWidth: PAIR_WIDTH }} gap={3}>
            <Selector
              label="Citizenship"
              options={CITIZENSHIP_OPTIONS}
              value={profile.citizenship}
              onChange={(value) => onChange("citizenship", value)}
            />
            <Selector
              label="Authorized to work in the U.S."
              options={YES_NO_OPTIONS}
              value={profile.workAuthorized}
              onChange={(value) => onChange("workAuthorized", value)}
            />
          </Grid>
          <Selector
            label="Visa sponsorship, now or in the future"
            options={VISA_OPTIONS}
            value={profile.visaSponsorship}
            onChange={(value) => onChange("visaSponsorship", value)}
          />
          <Grid columns={{ minWidth: PAIR_WIDTH }} gap={3}>
            <Selector
              label="Public trust"
              options={PUBLIC_TRUST_OPTIONS}
              value={profile.publicTrust}
              onChange={(value) => onChange("publicTrust", value)}
            />
            <Selector
              label="Security clearance"
              options={CLEARANCE_OPTIONS}
              value={profile.securityClearance}
              onChange={(value) => onChange("securityClearance", value)}
            />
          </Grid>
        </FormLayout>
      </SectionCard>
      <SectionCard title="Logistics" description="Where, how, and when you can start.">
        <FormLayout>
          <Grid columns={{ minWidth: PAIR_WIDTH }} gap={3}>
            <Selector
              label="18 or older"
              options={YES_NO_OPTIONS}
              value={profile.over18}
              onChange={(value) => onChange("over18", value)}
            />
            <Selector
              label="Agree to a background check"
              options={YES_NO_OPTIONS}
              value={profile.backgroundCheck}
              onChange={(value) => onChange("backgroundCheck", value)}
            />
            <Selector
              label="Willing to relocate"
              options={RELOCATE_OPTIONS}
              value={profile.willingToRelocate}
              onChange={(value) => onChange("willingToRelocate", value)}
            />
            <Selector
              label="Preferred work mode"
              options={WORK_MODE_OPTIONS}
              value={profile.workModePreference}
              onChange={(value) => onChange("workModePreference", value)}
            />
            <Selector
              label="Willing to travel"
              options={TRAVEL_OPTIONS}
              value={profile.willingToTravel}
              onChange={(value) => onChange("willingToTravel", value)}
            />
            <Selector
              label="Notice period"
              options={NOTICE_OPTIONS}
              value={profile.noticePeriod}
              onChange={(value) => onChange("noticePeriod", value)}
            />
          </Grid>
        </FormLayout>
      </SectionCard>
    </>
  );
}
