import { DocsChrome } from "@/components/DocsChrome";
import { Providers } from "@/components/Providers";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Joined",
  description: "Accessible, themeable React components from Meta.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <Providers>
          <DocsChrome>{children}</DocsChrome>
        </Providers>
      </body>
    </html>
  );
}
