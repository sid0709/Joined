"use client";

import { useState } from "react";
import { Button, Grid, Stack, TextInput } from "@joined/design-system";
import { SectionCard } from "@/components/section-card";
import { useProfileSave } from "@/components/profile/use-profile-save";
import type { Profile, ProfileLinks } from "@/lib/profile";

const FIELD_MIN_WIDTH = 220;

/** Name and public links at the top of the résumé. */
export function ResumeIdentity({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const save = useProfileSave(onSaved);
  const [name, setName] = useState(profile.name);
  const [links, setLinks] = useState<ProfileLinks>(profile.links);

  const setLink = (key: keyof ProfileLinks, value: string) =>
    setLinks((current) => ({ ...current, [key]: value }));

  return (
    <SectionCard
      title="Name and links"
      description="The heading recruiters read first. Email and phone save under Contact."
      action={
        <Button
          label="Save"
          variant="secondary"
          size="sm"
          isDisabled={!name.trim()}
          clickAction={async () => {
            await save({ name, links }, "Name and links saved");
          }}
        />
      }
    >
      <Stack gap={5}>
        <TextInput label="Full name" value={name} onChange={setName} isRequired />
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
    </SectionCard>
  );
}
