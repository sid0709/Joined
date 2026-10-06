import type { Metadata } from "next";
import { ServiceUpdate } from "@/components/service-update";
import { BRAND } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: "Moderation, scouts, jobs, and companies for Joined.",
};

export default function RootLayout() {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ServiceUpdate brand={BRAND} />
      </body>
    </html>
  );
}
