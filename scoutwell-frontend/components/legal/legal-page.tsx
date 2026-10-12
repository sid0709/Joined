import { Banner, PageHeader, SectionCard, Stack, Text } from "sid-ui";

export const LEGAL_DRAFT_BANNER =
  "Draft for review. This is not counsel-approved and it is not legal advice.";

export function LegalPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: readonly { title: string; body: string }[];
}) {
  return (
    <Stack gap={6}>
      <PageHeader title={title} description={description} />
      <Banner status="warning" title={LEGAL_DRAFT_BANNER} />
      <Stack gap={4}>
        {sections.map((section) => (
          <SectionCard key={section.title} title={section.title}>
            <Text color="secondary" display="block">
              {section.body}
            </Text>
          </SectionCard>
        ))}
      </Stack>
    </Stack>
  );
}
