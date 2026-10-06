import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { COOKIE_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies"
      description="Draft cookie notice. Necessary cookies stay on. Analytics is optional."
      sections={COOKIE_SECTIONS}
    />
  );
}
