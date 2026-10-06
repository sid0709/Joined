"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Stack,
  Text,
  TextArea,
  TextInput,
  Tokenizer,
  createStaticSource,
  useToast,
  type SearchableItem,
} from "sid-ui";
import { SectionCard } from "@/components/section-card";
import { saveProfile } from "@/lib/me/pipeline";
import {
  ABOUT_MAX_LENGTH,
  HEADLINE_MAX_LENGTH,
  SKILL_SUGGESTIONS,
  normalizeProfile,
  type Profile,
} from "@/lib/profile";

const ABOUT_ROWS = 5;
const toItems = (labels: string[]): SearchableItem[] =>
  labels.map((label) => ({ id: label, label }));

/** The words recruiters read first: headline, summary, and skills. */
export function ProfileAbout({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const toast = useToast();
  const skillSource = useMemo(() => createStaticSource(toItems(SKILL_SUGGESTIONS)), []);
  const [headline, setHeadline] = useState(profile.headline);
  const [about, setAbout] = useState(profile.about);
  const [skills, setSkills] = useState(toItems(profile.skills));

  const save = async () => {
    const next = normalizeProfile(
      await saveProfile({
        headline,
        about,
        skills: skills.map((item) => item.label),
      }),
    );
    onSaved(next);
    toast({ body: "About saved" });
  };

  return (
    <SectionCard
      title="About"
      description="Your headline shows on every application."
      action={<Button label="Save" variant="secondary" size="sm" clickAction={save} />}
    >
      <Stack gap={5}>
        <TextInput
          label="Headline"
          value={headline}
          onChange={(value) => setHeadline(value.slice(0, HEADLINE_MAX_LENGTH))}
          description={`Up to ${HEADLINE_MAX_LENGTH} characters.`}
        />
        <TextArea
          label="Summary"
          value={about}
          onChange={setAbout}
          rows={ABOUT_ROWS}
          maxLength={ABOUT_MAX_LENGTH}
        />
        <Stack gap={2}>
          <Text type="label" display="block">
            Skills
          </Text>
          <Tokenizer
            label="Skills"
            isLabelHidden
            searchSource={skillSource}
            value={skills}
            onChange={setSkills}
            hasEntriesOnFocus
            hasCreate
            placeholder="Add a skill"
          />
        </Stack>
      </Stack>
    </SectionCard>
  );
}
