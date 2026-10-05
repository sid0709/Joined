import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { hasJoinedSession } from "@/lib/auth/session";
import { extensionInstallUrl } from "@/lib/config";
import { INSTALL_HREF } from "@/lib/routes";

export const metadata: Metadata = { title: "Apply with your resume" };

export default async function HomePage() {
  const signedIn = await hasJoinedSession();
  return <LandingPage signedIn={signedIn} installHref={extensionInstallUrl() ?? INSTALL_HREF} />;
}
