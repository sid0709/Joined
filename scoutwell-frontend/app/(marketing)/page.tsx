import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { loadSession } from "@/lib/auth/session";
import { HOME_PAGE } from "@/lib/routes";
import { loadMeta } from "@/lib/scout/load";

export const metadata: Metadata = {
  title: "Scout jobs. Earn on outcomes.",
  description: HOME_PAGE.description,
};

export default async function HomePage() {
  const [session, meta] = await Promise.all([loadSession(), loadMeta()]);
  return <LandingPage meta={meta} signedIn={Boolean(session)} />;
}
