import { DirectJobDetail } from "@/components/trust/direct-job-detail";

export const metadata = { title: "Direct job review" };

export default async function DirectJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DirectJobDetail id={id} />;
}
