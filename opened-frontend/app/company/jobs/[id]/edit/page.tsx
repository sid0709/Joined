import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { JobPostEditor } from "@/components/company/post-job/job-post-editor";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { canManageCompany } from "@/lib/company/access";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await loadSession();
  if (!session?.company) return null;
  const { id } = await params;
  return (
    <Stack gap={6}>
      <PageHeader
        title="Edit job"
        description="Changes to an open job show up on the candidate posting right away."
      />
      <JobPostEditor
        company={session.company}
        canEditTeams={canManageCompany(session.company)}
        jobId={id}
      />
    </Stack>
  );
}
