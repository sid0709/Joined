import type { Metadata } from "next";
import { HowItWorksView } from "@/components/site/how-it-works-view";
import { HOW_IT_WORKS_PAGE } from "@/lib/routes";
import { loadMeta } from "@/lib/scout/load";

export const metadata: Metadata = {
  title: HOW_IT_WORKS_PAGE.label,
  description: HOW_IT_WORKS_PAGE.description,
};

export default async function HowItWorksPage() {
  const meta = await loadMeta();
  return <HowItWorksView meta={meta} />;
}
