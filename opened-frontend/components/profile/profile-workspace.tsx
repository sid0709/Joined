"use client";

import { useState } from "react";
import { GridColumn, GridSystem, Stack } from "@openseat/design-system";
import { ProfileAbout } from "@/components/profile/profile-about";
import { ProfileContact } from "@/components/profile/profile-contact";
import { ProfileExperience } from "@/components/profile/profile-experience";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfilePreferences } from "@/components/profile/profile-preferences";
import { ProfileResume } from "@/components/profile/profile-resume";
import { ProfileStrength } from "@/components/profile/profile-strength";
import { ProfileVisibility } from "@/components/profile/profile-visibility";
import { RESUMES } from "@/lib/resumes";
import { VISIBILITY_SETTINGS, strengthSteps, type Profile } from "@/lib/profile";

/** Signed-in profile: loads from the store and writes every section back. */
export function ProfileWorkspace({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState(initial);
  const hasResume = RESUMES.some((resume) => resume.isDefault && resume.parse === "parsed");

  return (
    <Stack gap={6}>
      <ProfileHero profile={profile} />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={6}>
            <ProfileContact profile={profile} onSaved={setProfile} />
            <ProfilePreferences profile={profile} onSaved={setProfile} />
            <ProfileAbout profile={profile} onSaved={setProfile} />
            <ProfileExperience profile={profile} onSaved={setProfile} />
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Stack gap={6}>
            <ProfileStrength steps={strengthSteps(profile, hasResume)} />
            <ProfileVisibility
              profile={profile}
              settings={VISIBILITY_SETTINGS}
              onSaved={setProfile}
            />
            <ProfileResume resumes={RESUMES} />
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
