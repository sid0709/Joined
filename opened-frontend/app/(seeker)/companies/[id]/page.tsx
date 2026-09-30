import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyProfileView } from "@/components/company/public/company-profile-view";
import { PageContainer } from "@/components/page-container";
import { loadCompany } from "@/lib/jobs/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const page = await loadCompany(id);
  return { title: page?.company.name ?? "Company" };
}

export default async function CompanyPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await loadCompany(id);
  if (!page) notFound();

  return (
    <PageContainer>
      <CompanyProfileView company={page.company} jobs={page.jobs} />
    </PageContainer>
  );
}
