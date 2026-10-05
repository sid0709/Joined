import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { currentAccount } from "@/lib/auth/session";
import { extensionInstallUrl } from "@/lib/config";
import { INSTALL_HREF } from "@/lib/routes";

export const metadata: Metadata = { title: "Apply with your resume" };

export default async function HomePage() {
  const account = await currentAccount();
  return (
    <LandingPage
      signedIn={account !== null}
      accountName={account?.name ?? null}
      installHref={extensionInstallUrl() ?? INSTALL_HREF}
    />
  );
}
