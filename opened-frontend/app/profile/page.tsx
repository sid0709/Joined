import type { Metadata } from "next";
import { Badge, HStack, Stack } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";
import { PROFILE_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: PROFILE_PAGE.label };

export default function ProfilePage() {
  return (
    <Stack gap={5}>
      <PageHeader
        title={PROFILE_PAGE.label}
        description={PROFILE_PAGE.description}
        action={<Badge label="Verified" variant="success" />}
      />
      <HStack>
        <ProfileForm />
      </HStack>
    </Stack>
  );
}
