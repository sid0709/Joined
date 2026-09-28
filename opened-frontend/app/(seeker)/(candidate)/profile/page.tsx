import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { ProfileWorkspace } from "@/components/profile/profile-workspace";
import { loadProfile } from "@/lib/me/load";
import { PROFILE_PAGE, ROUTES, signInHref } from "@/lib/routes";

export const metadata: Metadata = { title: PROFILE_PAGE.label };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await loadProfile();
  if (!profile) redirect(signInHref(ROUTES.profile));
  return (
    <PageContainer>
      <ProfileWorkspace initial={profile} />
    </PageContainer>
  );
}
