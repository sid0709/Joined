import { DocsChrome } from "@/components/DocsChrome";
import { Providers } from "@/components/Providers";

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenSeat",
  description: "Accessible, themeable React components from Meta.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
