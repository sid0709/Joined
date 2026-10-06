import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { loadLegalSections } from "@/lib/legal-docs";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      description="Draft privacy notice for Joined accounts."
      sections={loadLegalSections("privacy")}
    />
  );
}
