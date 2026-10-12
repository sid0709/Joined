import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { loadLegalSections } from "@/lib/legal-docs";

export const metadata: Metadata = { title: "Contractor terms" };

export default function ContractorTermsPage() {
  return (
    <LegalPage
      title="Scout contractor terms"
      description="Draft independent-contractor terms. This is not tax advice."
      sections={loadLegalSections("scout-contractor")}
    />
  );
}
