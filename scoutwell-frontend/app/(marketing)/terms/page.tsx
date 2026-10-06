import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { loadLegalSections } from "@/lib/legal-docs";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      description="Draft terms for using Joined and Scout."
      sections={loadLegalSections("terms")}
    />
  );
}
