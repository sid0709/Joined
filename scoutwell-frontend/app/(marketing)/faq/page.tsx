import type { Metadata } from "next";
import { FaqView } from "@/components/site/faq-view";
import { FAQ_PAGE } from "@/lib/routes";
import { loadMeta } from "@/lib/scout/load";

export const metadata: Metadata = {
  title: FAQ_PAGE.label,
  description: FAQ_PAGE.description,
};

export default async function FaqPage() {
  const meta = await loadMeta();
  return <FaqView meta={meta} />;
}
