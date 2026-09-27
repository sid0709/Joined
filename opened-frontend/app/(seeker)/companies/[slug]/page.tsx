import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyProfileView } from "@/components/company/public/company-profile-view";
import { PageContainer } from "@/components/page-container";
import { WORKSPACE } from "@/lib/company";
import { COMPANIES, companyBySlug, jobsForCompany } from "@/lib/jobs";

export function generateStaticParams() {
  return COMPANIES.map((company) => ({ slug: company.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = companyBySlug(slug);
  return { title: company?.name ?? "Company" };
}

export default async function CompanyPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = companyBySlug(slug);
  if (!company) notFound();
  // Only the signed-in workspace has page extras (tagline, perks) until companies can edit theirs.
  const profile = slug === WORKSPACE.slug ? WORKSPACE : company;

  return (
    <PageContainer>
      <CompanyProfileView company={profile} jobs={jobsForCompany(company.slug)} />
    </PageContainer>
  );
}
