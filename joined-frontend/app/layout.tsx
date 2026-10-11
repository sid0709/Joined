import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BROWSER_THEME_COLOR } from "sid-ui/browser-theme";
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

/** Mobile browser chrome runs into the header in either color scheme. */
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BROWSER_THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: BROWSER_THEME_COLOR.dark },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
