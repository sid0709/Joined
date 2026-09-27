import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, Stack } from "@openseat/design-system";
import { JobDetail } from "@/components/job-detail";
import { JOBS, jobById } from "@/lib/jobs";

export function generateStaticParams() {
  return JOBS.map((job) => ({ id: job.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const job = jobById(id);
  return { title: job ? `${job.title} at ${job.company}` : "Job" };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = jobById(id);
  if (!job) notFound();

  return (
    <Stack gap={5} maxWidth={760}>
      <Card>
        <JobDetail job={job} />
      </Card>
    </Stack>
  );
}
