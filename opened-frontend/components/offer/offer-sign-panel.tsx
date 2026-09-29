"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  Badge,
  Button,
  EmptyState,
  Heading,
  HStack,
  Stack,
  Text,
} from "@openseat/design-system";
import { CompanyRequestError } from "@/lib/me/client";
import { fetchMyOfferEsign, respondMyOfferEsign } from "@/lib/me/offer-esign";
import type { OfferEsign } from "@/lib/offer-hire";
import { ROUTES, signInHref } from "@/lib/routes";

function esignErrorMessage(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    if (error.status === 401) return "Sign in with the applicant account to countersign.";
    if (error.status === 403) return error.message || "You cannot sign this offer.";
    if (error.status === 404)
      return error.message || "No offer e-sign link found for this application.";
    if (error.status === 400) return error.message || "Create a sign link before responding.";
    return error.message || "Could not update e-sign status.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not update e-sign status.";
}

/** Candidate countersign / decline for first-party offer e-sign. */
export function OfferSignPanel({
  applicantId,
  signedIn,
}: {
  applicantId: string;
  signedIn: boolean;
}) {
  const [esign, setEsign] = useState<OfferEsign | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(signedIn);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchMyOfferEsign(applicantId)
      .then((next) => {
        if (!cancelled) setEsign(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(esignErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicantId, signedIn]);

  const respond = (status: "signed" | "declined") => {
    setActionError(null);
    setBusy(true);
    respondMyOfferEsign(applicantId, { status })
      .then((next) => setEsign(next))
      .catch((error: unknown) => setActionError(esignErrorMessage(error)))
      .finally(() => setBusy(false));
  };

  if (!signedIn) {
    return (
      <Stack gap={6}>
        <EmptyState
          title="Sign your offer"
          description="Sign in with the applicant account that received this offer to review and countersign. First-party OpenSeat e-sign only — no DocuSign."
          actions={
            <Button
              label="Sign in to continue"
              variant="primary"
              href={signInHref(ROUTES.offerSign(applicantId))}
            />
          }
        />
        <Text type="supporting" color="secondary">
          Offer {applicantId}
        </Text>
      </Stack>
    );
  }

  if (loading) {
    return (
      <Stack gap={4}>
        <Heading level={1}>Sign your offer</Heading>
        <Text type="supporting" color="secondary">
          Loading e-sign status…
        </Text>
      </Stack>
    );
  }

  if (loadError) {
    return (
      <Stack gap={6}>
        <EmptyState
          title="Offer e-sign unavailable"
          description={loadError}
          actions={<Button label="Browse jobs" variant="primary" href={ROUTES.search} />}
        />
        <Banner status="error" title="Could not load e-sign" description={loadError} />
      </Stack>
    );
  }

  const status = esign?.status ?? "none";
  const canRespond = status === "pending";
  const done = status === "signed" || status === "declined";

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Heading level={1}>Sign your offer</Heading>
        <Text type="supporting" color="secondary">
          Review and countersign on OpenSeat. No DocuSign. This link is for the applicant on this
          application only.
        </Text>
        <HStack gap={2} wrap="wrap" vAlign="center">
          <Badge
            label={status}
            variant={status === "signed" ? "success" : status === "declined" ? "error" : "info"}
          />
          {esign?.documentTitle ? (
            <Text type="supporting" color="secondary">
              {esign.documentTitle}
            </Text>
          ) : null}
        </HStack>
      </Stack>

      {actionError ? (
        <Banner status="error" title="Could not update e-sign" description={actionError} />
      ) : null}

      {status === "none" ? (
        <Banner
          status="info"
          title="Sign link not ready"
          description="The hiring team has not minted a first-party sign link for this offer yet. Check back after they create one from Hire."
        />
      ) : null}

      {status === "signed" ? (
        <Banner
          status="success"
          title="Offer signed"
          description={
            esign?.signedAt
              ? `You signed this offer at ${new Date(esign.signedAt).toLocaleString()}.`
              : "You signed this offer."
          }
        />
      ) : null}

      {status === "declined" ? (
        <Banner
          status="warning"
          title="E-sign declined"
          description="You declined to sign this offer. Contact the hiring team if that was a mistake."
        />
      ) : null}

      {canRespond ? (
        <Stack gap={3}>
          <Text type="supporting" color="secondary">
            Countersign to accept the letter, or decline if you will not sign. This does not change
            overall offer status by itself — the hiring team still tracks accepted / declined on the
            offer record.
          </Text>
          <HStack gap={2} wrap="wrap">
            <Button
              label="Sign offer"
              variant="primary"
              onClick={() => respond("signed")}
              isDisabled={busy}
            />
            <Button
              label="Decline to sign"
              variant="ghost"
              onClick={() => respond("declined")}
              isDisabled={busy}
            />
          </HStack>
        </Stack>
      ) : null}

      {done ? (
        <Button label="View applications" variant="secondary" href={ROUTES.applications} />
      ) : (
        <Button label="Browse jobs" variant="secondary" href={ROUTES.search} />
      )}
    </Stack>
  );
}
