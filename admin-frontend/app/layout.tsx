import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { JoinedProvider } from "sid-ui/theme";
import { ServiceUpdate } from "@/components/service-update";
import { BRAND } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: "Moderation, scouts, jobs, and companies for Joined.",
};

export default function RootLayout({ children: _children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <JoinedProvider mode="light" linkComponent={Link}>
          <ServiceUpdate brand={BRAND} />
        </JoinedProvider>
      </body>
    </html>
  );
}
