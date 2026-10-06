import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { loadLegalSections } from "@/lib/legal-docs";

export const metadata: Metadata = { title: "Premium terms" };

export default function PremiumTermsPage() {
  return (
    <LegalPage
      title="Joined Premium terms"
      description="Draft subscription terms. Checkout stays in Stripe test mode."
      sections={loadLegalSections("premium-terms")}
    />
  );
}
