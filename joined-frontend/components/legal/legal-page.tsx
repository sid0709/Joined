import { Banner, SectionCard, Stack, Text } from "sid-ui";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { LEGAL_DRAFT_BANNER } from "@/lib/legal";

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
    <PageContainer>
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
    </PageContainer>
  );
}
