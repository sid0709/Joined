import type { Metadata } from "next";
import { Badge, Card, FileUploader, HStack, Heading, List, ListItem, Stack, Text } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { RESUMES } from "@/lib/account";
import { RESUMES_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: RESUMES_PAGE.label };

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export default function ResumesPage() {
  return (
    <Stack gap={5} maxWidth={720}>
      <PageHeader title={RESUMES_PAGE.label} description={RESUMES_PAGE.description} />
      <Card padding={2}>
        <List hasDividers header={<Heading level={2}>Versions</Heading>}>
          {RESUMES.map((resume) => (
            <ListItem
              key={resume.id}
              label={resume.label}
              description={`Updated ${resume.updated}`}
              endContent={
                <HStack gap={2} vAlign="center">
                  {resume.isDefault ? <Badge label="Default" variant="success" /> : null}
                  <Text type="supporting" color="secondary">
                    PDF
                  </Text>
                </HStack>
              }
            />
          ))}
        </List>
      </Card>
      <FileUploader
        label="Upload a resume"
        description="PDF or DOCX. Parsing can fail; the file is still kept."
        accept=".pdf,.docx,application/pdf"
        maxSize={MAX_RESUME_BYTES}
        isMultiple={false}
      />
    </Stack>
  );
}
