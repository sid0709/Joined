"use client";

import { useState } from "react";
import { Button, Grid, NumberInput, Stack, Text, TextInput } from "sid-ui";
import { ChoiceField } from "@/components/profile/choice-field";
import { SectionCard } from "@/components/section-card";
import { useProfileSave } from "@/components/profile/use-profile-save";
import {
  CITIZENSHIP_OPTIONS,
  GENDER_OPTIONS,
  MAX_AGE,
  MIN_AGE,
  ORIENTATION_OPTIONS,
  PRONOUN_OPTIONS,
} from "@/lib/profile-options";
import type { Personal, Profile, ProfileLinks } from "@/lib/profile";

const FIELD_MIN_WIDTH = 220;

/** Name, identity, citizenship, and public links — what application forms ask first. */
export function ProfilePersonal({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const save = useProfileSave(onSaved);
  const [name, setName] = useState(profile.name);
  const [personal, setPersonal] = useState<Personal>(profile.personal);
  const [links, setLinks] = useState<ProfileLinks>(profile.links);

  const set = (patch: Partial<Personal>) => setPersonal((current) => ({ ...current, ...patch }));
  const setLink = (key: keyof ProfileLinks, value: string) =>
    setLinks((current) => ({ ...current, [key]: value }));
  const isAgeValid = !personal.age || (personal.age >= MIN_AGE && personal.age <= MAX_AGE);

  return (
    <SectionCard
      title="Personal details"
      description="Only you and Acorn see these. Acorn fills them into application forms."
      action={
        <Button
          label="Save"
          variant="secondary"
          size="sm"
          isDisabled={!name.trim() || !isAgeValid}
          clickAction={async () => {
            await save({ name, personal, links }, "Personal details saved");
          }}
        />
      }
    >
      <Stack gap={5}>
        <TextInput label="Full name" value={name} onChange={setName} isRequired />
        <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={4}>
          <TextInput
            label="First name"
            description="As forms should show it. Defaults to your full name's first word."
            value={personal.firstName}
            onChange={(firstName) => set({ firstName })}
            isOptional
          />
          <TextInput
            label="Last name"
            value={personal.lastName}
            onChange={(lastName) => set({ lastName })}
            isOptional
          />
          <NumberInput
            label="Age"
            value={personal.age || null}
            onChange={(age) => set({ age: age ?? 0 })}
            min={MIN_AGE}
            max={MAX_AGE}
            isIntegerOnly
            hasClear
            isOptional
          />
          <ChoiceField
            label="Gender"
            options={GENDER_OPTIONS}
            value={personal.gender}
            onChange={(gender) => set({ gender })}
          />
          <ChoiceField
            label="Pronouns"
            options={PRONOUN_OPTIONS}
            value={personal.pronouns}
            onChange={(pronouns) => set({ pronouns })}
          />
          <ChoiceField
            label="Sexual orientation"
            options={ORIENTATION_OPTIONS}
            value={personal.orientation}
            onChange={(orientation) => set({ orientation })}
          />
        </Grid>
        <ChoiceField
          label="Citizenship"
          description="Acorn answers “Are you authorized to work…” questions from this."
          options={CITIZENSHIP_OPTIONS}
          value={personal.citizenship}
          onChange={(citizenship) => set({ citizenship })}
        />
        <Stack gap={3}>
          <Text type="label" display="block">
            Links
          </Text>
          <TextInput
            label="LinkedIn"
            value={links.linkedin}
            onChange={(value) => setLink("linkedin", value)}
            placeholder="https://www.linkedin.com/in/you"
            isOptional
          />
          <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={4}>
            <TextInput
              label="GitHub"
              value={links.github}
              onChange={(value) => setLink("github", value)}
              placeholder="https://github.com/you"
              isOptional
            />
            <TextInput
              label="Portfolio"
              value={links.portfolio}
              onChange={(value) => setLink("portfolio", value)}
              placeholder="https://you.dev"
              isOptional
            />
          </Grid>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
