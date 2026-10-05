import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { currentAccount } from "@/lib/auth/session";
import { extensionInstallUrl } from "@/lib/config";
import { INSTALL_HREF, ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Apply with your resume" };

export default async function HomePage() {
  if (await currentAccount()) redirect(ROUTES.overview);
  return <LandingPage installHref={extensionInstallUrl() ?? INSTALL_HREF} />;
}
