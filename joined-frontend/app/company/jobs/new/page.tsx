import type { Metadata } from "next";
import { Stack } from "sid-ui";
import { JobPostEditor } from "@/components/company/post-job/job-post-editor";
import { PageHeader } from "@/components/page-header";
import { loadSession } from "@/lib/auth/session";
import { canManageCompany, sessionHiringRole } from "@/lib/company/access";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const session = await loadSession();
  if (!session?.company) return null;
  return (
    <Stack gap={6}>
      <PageHeader
        title="Post a job"
        description="Posting is free. Scheduling an interview spends your purchase balance, and a no-show returns it."
      />
      <JobPostEditor
        company={session.company}
        canEditTeams={canManageCompany(session.company)}
        actorRole={sessionHiringRole(session.company)}
      />
    </Stack>
  );
}
