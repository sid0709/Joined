import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { joinedWebOrigin } from "@/lib/config";
import { BRAND } from "@/lib/routes";
import "./globals.css";

const origin = joinedWebOrigin();

export const metadata: Metadata = {
  metadataBase: origin,
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: "Search jobs and hire. Free for job hunters and companies.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
