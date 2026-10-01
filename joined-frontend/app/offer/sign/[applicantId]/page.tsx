import type { Metadata } from "next";
import { AppFrame } from "@/components/shell/app-frame";
import { SeekerHeader } from "@/components/shell/seeker-header";
import { OfferSignPanel } from "@/components/offer/offer-sign-panel";
import { loadSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign your offer",
  description: "Review and sign your Joined offer letter.",
};

/**
 * Public first-party offer e-sign landing.
 * Einstein mints `{FRONTEND_ORIGIN}/offer/sign/{applicantId}` via POST
 * /v1/company/applicants/:id/offer/esign.
 * Candidate GET/POST /v1/me/applications/:id/offer/esign
 * `{ status: "signed" | "declined" }` (applicant session only).
 */
export default async function PublicOfferSignPage({
  params,
}: {
  params: Promise<{ applicantId: string }>;
}) {
  const { applicantId } = await params;
  const session = await loadSession();

  return (
    <AppFrame header={<SeekerHeader session={session} />}>
      <OfferSignPanel applicantId={applicantId} signedIn={Boolean(session)} />
    </AppFrame>
  );
}
