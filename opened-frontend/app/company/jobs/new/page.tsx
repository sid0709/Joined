import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { JobPostEditor } from "@/components/company/post-job/job-post-editor";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Post a job" };

export default function NewJobPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title="Post a job"
        description="Verified companies post for free. You pay only when a candidate attends an interview scheduled here."
      />
      <JobPostEditor />
    </Stack>
  );
}
