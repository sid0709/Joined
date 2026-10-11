"use client";

import { useState } from "react";
import { Button, Grid, Stack, Text, TextInput } from "sid-ui";
import { SaveFooter } from "@/components/save-footer";
import { SectionCard } from "@/components/section-card";
import { useProfileSave } from "@/components/profile/use-profile-save";
import type { Personal, Profile, ProfileLinks } from "@/lib/profile";

const FIELD_MIN_WIDTH = 220;

/** Name and public links — what application forms ask first. */
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

  return (
    <SectionCard
      title="Name and links"
      description="Acorn fills these into application forms."
      footer={
        <SaveFooter
          action={
            <Button
              label="Save"
              variant="primary"
              size="sm"
              isDisabled={!name.trim()}
              clickAction={async () => {
                await save({ name, personal, links }, "Name and links saved");
              }}
            />
          }
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
        </Grid>
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
