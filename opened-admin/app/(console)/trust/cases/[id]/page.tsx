import { ModerationCaseDetail } from "@/components/trust/moderation-detail";

export const metadata = { title: "Case" };

export default async function ModerationCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModerationCaseDetail id={id} />;
}
