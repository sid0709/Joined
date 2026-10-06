import type { Metadata } from "next";
import { ServiceUpdate } from "@/components/service-update";
import { joinedWebOrigin } from "@/lib/config";
import { BRAND } from "@/lib/routes";
import "./globals.css";

const origin = joinedWebOrigin();

export const metadata: Metadata = {
  metadataBase: origin,
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: "Search jobs and hire. Free for job hunters and companies.",
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
