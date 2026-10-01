import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeProviders } from "@/src/shared/components/ThemeProviders";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Joined",
  description: "A permissioned help marketplace — sealed job rooms, invited bidders.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const storedTheme = (await cookies()).get("joined-theme")?.value;
  const initialTheme = storedTheme === "light" ? "light" : "dark";
  return (
    <html
      lang="en"
      data-theme={initialTheme}
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('joined-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProviders mode={initialTheme}>{children}</ThemeProviders>
      </body>
    </html>
  );
}
