import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { JobPostForm } from "@/components/job-post-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Post a job" };

export default function NewJobPage() {
  return (
    <Stack gap={5}>
      <PageHeader title="Post a job" description="Verified companies post for free. You pay when a candidate attends an interview scheduled here." />
      <JobPostForm />
    </Stack>
  );
}
