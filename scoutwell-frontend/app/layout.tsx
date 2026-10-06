import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ServiceUpdate } from "@/components/service-update";
import { BRAND, THEME_COOKIE } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description:
    "Submit official jobs missing from the big boards. Earn when hunters and bidders use them.",
};

export default async function RootLayout() {
  const theme = (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ServiceUpdate brand={BRAND} mode={theme} />
      </body>
    </html>
  );
}
