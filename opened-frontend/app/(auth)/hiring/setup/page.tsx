import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HiringSetupForm } from "@/components/auth/hiring-setup-form";
import { loadSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Set up hiring" };

export default async function HiringSetupPage() {
  const session = await loadSession();
  if (!session) redirect(`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.hiringSetup)}`);
  if (session.company) redirect(ROUTES.company);
  return <HiringSetupForm />;
}
