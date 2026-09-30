import { CompanyCaseDetail } from "@/components/trust/case-detail";

export const metadata = { title: "Verification case" };

export default async function CompanyCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyCaseDetail id={id} />;
}
