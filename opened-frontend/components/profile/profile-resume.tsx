import { Badge, Button, HStack, Glyph, Stack, Text } from "@openseat/design-system";
import type { ResumeVersion } from "@/lib/account";
import { ROUTES } from "@/lib/routes";
import { ProfileSection } from "./profile-section";

/** The resume sent with direct applications. */
export function ProfileResume({ resumes }: { resumes: ResumeVersion[] }) {
  return (
    <ProfileSection
      title="Resumes"
      description="The default goes out with direct applications."
      footer={<Button label="Manage resumes" variant="secondary" width="100%" href={ROUTES.resumes} />}
    >
      <Stack gap={3}>
        {resumes.map((resume) => (
          <HStack key={resume.id} gap={3} vAlign="center" hAlign="between">
            <HStack gap={3} vAlign="center">
              <Text color="secondary">
                <Glyph name="file" />
              </Text>
              <Stack gap={0.5}>
                <Text weight="medium">{resume.label}</Text>
                <Text type="supporting" color="secondary">
                  Updated {resume.updated}
                </Text>
              </Stack>
            </HStack>
            {resume.isDefault ? <Badge label="Default" variant="neutral" /> : null}
          </HStack>
        ))}
      </Stack>
    </ProfileSection>
  );
}
