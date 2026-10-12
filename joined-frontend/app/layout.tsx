import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BROWSER_THEME_COLOR } from "sid-ui/browser-theme";
import { GoogleSiteTags, GoogleTagManagerNoScript } from "@/components/analytics/google-site-tags";
import { Providers } from "@/components/providers";
import { googleSiteVerification, joinedWebOrigin } from "@/lib/config";
import { BRAND } from "@/lib/routes";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const origin = joinedWebOrigin();
  const verificationToken = googleSiteVerification();
  return {
    metadataBase: origin,
    title: { default: BRAND, template: `%s · ${BRAND}` },
    description: "Search jobs and hire. Free for job hunters and companies.",
    verification: verificationToken ? { google: verificationToken } : undefined,
  };
}

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
      <head>
        <GoogleSiteTags />
      </head>
      <body suppressHydrationWarning>
        <GoogleTagManagerNoScript />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
