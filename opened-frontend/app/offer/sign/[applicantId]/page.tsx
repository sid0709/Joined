import type { Metadata } from "next";
import { Banner, Button, EmptyState, Stack, Text } from "@openseat/design-system";
import { AppFrame } from "@/components/shell/app-frame";
import { SeekerHeader } from "@/components/shell/seeker-header";
import { loadSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sign your offer",
  description: "Review and sign your OpenSeat offer letter.",
};

/**
 * Public first-party offer e-sign landing.
 * Einstein mints `{FRONTEND_ORIGIN}/offer/sign/{applicantId}` via POST
 * /v1/company/applicants/:id/offer/esign. Candidate sign UX is still FE-later —
 * employers can mint and share the link; signing on this page is not live yet.
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
      <Stack gap={6}>
        <EmptyState
          title="Sign your offer"
          description="This first-party e-sign link is ready on the employer side. Candidate sign UX is not live yet — the hiring team can still track offer status from Hire."
          actions={<Button label="Browse jobs" variant="primary" href={ROUTES.search} />}
        />
        <Banner
          status="info"
          title="Coming soon"
          description={`Offer ${applicantId} — when sign UX lands, you will review compensation and countersign here. No DocuSign.`}
        />
        <Text type="supporting" color="secondary">
          If you already have an Opened account, sign in and check Applications for updates from the
          company.
        </Text>
      </Stack>
    </AppFrame>
  );
}
