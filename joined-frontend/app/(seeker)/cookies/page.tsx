import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { loadLegalSections } from "@/lib/legal-docs";

export const metadata: Metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies"
      description="Draft cookie notice. Necessary cookies stay on. Analytics is optional."
      sections={loadLegalSections("cookies")}
    />
  );
}
