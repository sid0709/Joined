"use client";

import { useState } from "react";
import { Button, Grid } from "@joined/design-system";
import { ChoiceField } from "@/components/profile/choice-field";
import { SectionCard } from "@/components/section-card";
import { useProfileSave } from "@/components/profile/use-profile-save";
import {
  DISABILITY_OPTIONS,
  HISPANIC_OPTIONS,
  RACE_OPTIONS,
  SPONSORSHIP_OPTIONS,
  VETERAN_OPTIONS,
} from "@/lib/profile-options";
import type { Disclosures, Profile } from "@/lib/profile";

const FIELD_MIN_WIDTH = 220;

/** EEO and sponsorship answers Acorn gives on voluntary self-identification forms. */
export function ProfileDisclosures({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const save = useProfileSave(onSaved);
  const [disclosures, setDisclosures] = useState<Disclosures>(profile.disclosures);
  const set = (patch: Partial<Disclosures>) =>
    setDisclosures((current) => ({ ...current, ...patch }));

  return (
    <SectionCard
      title="Voluntary disclosures"
      description="EEO and sponsorship answers. Companies never see them on your profile; Acorn uses them only to fill those questions."
      action={
        <Button
          label="Save"
          variant="secondary"
          size="sm"
          clickAction={async () => {
            await save({ disclosures }, "Disclosures saved");
          }}
        />
      }
    >
      <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={4}>
        <ChoiceField
          label="Hispanic / Latino"
          options={HISPANIC_OPTIONS}
          value={disclosures.hispanicLatino}
          onChange={(hispanicLatino) => set({ hispanicLatino })}
        />
        <ChoiceField
          label="Race / ethnicity"
          options={RACE_OPTIONS}
          value={disclosures.race}
          onChange={(race) => set({ race })}
        />
        <ChoiceField
          label="Visa sponsorship"
          options={SPONSORSHIP_OPTIONS}
          value={disclosures.sponsorship}
          onChange={(sponsorship) => set({ sponsorship })}
        />
        <ChoiceField
          label="Disability"
          options={DISABILITY_OPTIONS}
          value={disclosures.disability}
          onChange={(disability) => set({ disability })}
        />
        <ChoiceField
          label="Veteran status"
          options={VETERAN_OPTIONS}
          value={disclosures.veteran}
          onChange={(veteran) => set({ veteran })}
        />
      </Grid>
    </SectionCard>
  );
}
