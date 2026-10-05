import type { ReactNode } from "react";
import { PageHeader, Stack } from "sid-ui";
import { ResumeTabs } from "@/components/workspace/resume/resume-tabs";

export default function ResumeLayout({ children }: { children: ReactNode }) {
  return (
    <Stack gap={6}>
      <PageHeader
        title="Resume"
        description="Generate a draft for one posting, keep your own files in the library, and look back at every draft."
      />
      <ResumeTabs />
      {children}
    </Stack>
  );
}
