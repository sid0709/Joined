import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, Heading, List, ListItem, Stack, Text } from "@openseat/design-system";
import { COMPANIES, companyBySlug, jobsForCompany } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";

export function generateStaticParams() {
  return COMPANIES.map((company) => ({ slug: company.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const company = companyBySlug(slug);
  return { title: company?.name ?? "Company" };
}

export default async function CompanyPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = companyBySlug(slug);
  if (!company) notFound();
  const jobs = jobsForCompany(company.slug);

  return (
    <Stack gap={5} maxWidth={760}>
      <Stack gap={1}>
        <Heading level={1}>{company.name}</Heading>
        <Text color="secondary" display="block">
          {company.locations}
        </Text>
        <Text display="block">{company.about}</Text>
      </Stack>
      <Card padding={2}>
        <List hasDividers header={<Heading level={2}>Open jobs</Heading>}>
          {jobs.map((job) => (
            <ListItem key={job.id} label={job.title} description={`${job.location} · ${job.salary}`} href={ROUTES.job(job.id)} />
          ))}
        </List>
      </Card>
    </Stack>
  );
}
