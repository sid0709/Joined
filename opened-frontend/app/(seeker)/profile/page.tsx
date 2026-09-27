import type { Metadata } from "next";
import { GridColumn, GridSystem, Stack } from "@openseat/design-system";
import { PageContainer } from "@/components/page-container";
import { ProfileAbout } from "@/components/profile/profile-about";
import { ProfileExperience } from "@/components/profile/profile-experience";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfilePreferences } from "@/components/profile/profile-preferences";
import { ProfileResume } from "@/components/profile/profile-resume";
import { ProfileStrength } from "@/components/profile/profile-strength";
import { ProfileVisibility } from "@/components/profile/profile-visibility";
import { RESUMES } from "@/lib/resumes";
import { EXPERIENCE, PROFILE, STRENGTH_STEPS, VISIBILITY_SETTINGS } from "@/lib/profile";
import { PROFILE_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: PROFILE_PAGE.label };

export default function ProfilePage() {
  return (
    <PageContainer>
      <ProfileHero profile={PROFILE} />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={6}>
            <ProfilePreferences profile={PROFILE} />
            <ProfileAbout profile={PROFILE} />
            <ProfileExperience items={EXPERIENCE} />
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Stack gap={6}>
            <ProfileStrength steps={STRENGTH_STEPS} />
            <ProfileVisibility profile={PROFILE} settings={VISIBILITY_SETTINGS} />
            <ProfileResume resumes={RESUMES} />
          </Stack>
        </GridColumn>
      </GridSystem>
    </PageContainer>
  );
}
