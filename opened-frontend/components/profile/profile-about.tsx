"use client";

import { useState } from "react";
import {
  Button,
  HStack,
  Stack,
  Text,
  TextArea,
  TextInput,
  Token,
  useToast,
} from "@openseat/design-system";
import { ABOUT_MAX_LENGTH, HEADLINE_MAX_LENGTH, type Profile } from "@/lib/profile";
import { SectionCard } from "@/components/section-card";

const ABOUT_ROWS = 5;

/** The words recruiters read first: headline, summary, and skills. */
export function ProfileAbout({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [headline, setHeadline] = useState(profile.headline);
  const [about, setAbout] = useState(profile.about);

  return (
    <SectionCard
      title="About"
      description="Your headline shows on every application."
      action={
        <Button
          label="Save"
          variant="secondary"
          size="sm"
          onClick={() => toast({ body: "About saved" })}
        />
      }
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
          <HStack gap={2} wrap="wrap">
            {profile.skills.map((skill) => (
              <Token key={skill} label={skill} />
            ))}
          </HStack>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
