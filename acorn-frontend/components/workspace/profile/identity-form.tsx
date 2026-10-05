import { FormLayout, Grid, SectionCard, Selector, StateSelector, TextInput } from "sid-ui";
import { PHONE_MAX } from "@/lib/workspace/model";
import {
  ADDRESS_MAX,
  AGE_MAX,
  COUNTRY_OPTIONS,
  GENDER_OPTIONS,
  LINK_MAX,
  ORIENTATION_OPTIONS,
  PRONOUN_OPTIONS,
  SECRET_MAX,
  type ApplicantProfile,
  type SetProfileField,
} from "@/lib/workspace/profile";
import { PAIR_WIDTH } from "./form-layout";

/** Name, contact, location, and links. */
export function IdentityForm({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: SetProfileField;
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
            label="Middle name"
            value={profile.middleName}
            onChange={(value) => onChange("middleName", value)}
            isOptional
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
