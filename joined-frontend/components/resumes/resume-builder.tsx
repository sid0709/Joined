"use client";

import { Stack } from "sid-ui";
import { ProfileAbout } from "@/components/profile/profile-about";
import { ProfileContact } from "@/components/profile/profile-contact";
import { ProfileEducation } from "@/components/profile/profile-education";
import { ProfileExperience } from "@/components/profile/profile-experience";
import type { Profile } from "@/lib/profile";
import { ResumeIdentity } from "./resume-identity";

/** Core résumé sections. Each save writes GET/PATCH `/v1/me/profile`. */
export function ResumeBuilder({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  return (
    <Stack gap={6}>
      <ResumeIdentity profile={profile} onSaved={onSaved} />
      <ProfileContact profile={profile} onSaved={onSaved} />
      <ProfileAbout profile={profile} onSaved={onSaved} />
      <ProfileExperience profile={profile} onSaved={onSaved} />
      <ProfileEducation profile={profile} onSaved={onSaved} />
    </Stack>
  );
}
