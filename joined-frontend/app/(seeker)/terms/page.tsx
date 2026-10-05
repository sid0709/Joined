import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMS_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      description="Draft terms for using Joined."
      sections={TERMS_SECTIONS}
    />
  );
}
