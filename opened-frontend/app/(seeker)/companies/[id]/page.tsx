import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyProfileView } from "@/components/company/public/company-profile-view";
import { PageContainer } from "@/components/page-container";
import { loadCompany } from "@/lib/jobs/catalog";

export const dynamic = "force-dynamic";

function queryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || "";
  return value?.trim() || "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const page = await loadCompany(id);
  return { title: page?.company.name ?? "Company" };
}

export default async function CompanyPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ department?: string | string[]; location?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const department = queryValue(query.department);
  const location = queryValue(query.location);
  const catalog = await loadCompany(id);
  if (!catalog) notFound();
  const page =
    department || location
      ? ((await loadCompany(id, { department, location })) ?? catalog)
      : catalog;

  return (
    <PageContainer>
      <CompanyProfileView
        company={page.company}
        jobs={page.jobs}
        allJobs={catalog.jobs}
        companyId={id}
        departmentFilter={department}
        locationFilter={location}
      />
    </PageContainer>
  );
}
