"use client";

import { useState } from "react";
import { Card, GridColumn, GridSystem, Stack } from "sid-ui";
import { ProfileAbout } from "@/components/profile/profile-about";
import { ProfileContact } from "@/components/profile/profile-contact";
import { ProfileEducation } from "@/components/profile/profile-education";
import { ProfileExperience } from "@/components/profile/profile-experience";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfilePersonal } from "@/components/profile/profile-personal";
import { ProfilePreferences } from "@/components/profile/profile-preferences";
import { ProfileResume } from "@/components/profile/profile-resume";
import { ProfileStrength } from "@/components/profile/profile-strength";
import { ProfileVisibility } from "@/components/profile/profile-visibility";
import { ResumeAutofill } from "@/components/resumes/resume-autofill";
import { isResumeReady, profileResume } from "@/lib/resumes";
import { VISIBILITY_SETTINGS, strengthSteps, type Profile } from "@/lib/profile";

/** Signed-in profile: loads from the store and writes every section back. */
export function ProfileWorkspace({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState(initial);
  // Bumped after a résumé fills the profile, so every section's form starts over from it.
  const [fillCount, setFillCount] = useState(0);
  const hasResume = isResumeReady(profile);

  const fillFromResume = (next: Profile) => {
    setProfile(next);
    setFillCount((count) => count + 1);
  };

  return (
    <Stack gap={6}>
      <ProfileHero profile={profile} />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={6}>
            <Card padding={5}>
              <ResumeAutofill onFilled={fillFromResume} />
            </Card>
            <Stack gap={6} key={fillCount}>
              <ProfileContact profile={profile} onSaved={setProfile} />
              <ProfilePersonal profile={profile} onSaved={setProfile} />
              <ProfilePreferences profile={profile} onSaved={setProfile} />
              <ProfileAbout profile={profile} onSaved={setProfile} />
              <ProfileExperience profile={profile} onSaved={setProfile} />
              <ProfileEducation profile={profile} onSaved={setProfile} />
            </Stack>
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
            <ProfileResume resumes={[profileResume(profile)]} />
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
