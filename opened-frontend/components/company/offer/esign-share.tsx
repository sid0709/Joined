"use client";

import { Banner, Button, HStack, Stack, Text, TextInput, useToast } from "@openseat/design-system";
import { scaffoldEsignUrl } from "@/lib/offer-hire";

/** Share (or scaffold) a first-party offer e-sign link — no DocuSign. */
export function EsignShare({
  applicantId,
  url,
  candidate,
}: {
  applicantId: string;
  url?: string | null;
  candidate?: string;
}) {
  const toast = useToast();
  const live = Boolean(url && url.trim());
  const display = live ? url!.trim() : scaffoldEsignUrl(applicantId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      toast({
        body: live ? "E-sign link copied." : "Scaffold e-sign link copied — Einstein mint pending.",
      });
    } catch {
      toast({ body: "Could not copy link.", type: "error" });
    }
  };

  return (
    <Stack gap={2}>
      {!live ? (
        <Banner
          status="info"
          title="E-sign link not minted yet"
          description="First-party only. Einstein should return offer.esign.signUrl (see lib/offer-hire.ts). No DocuSign."
        />
      ) : null}
      <Text type="supporting" color="secondary">
        {candidate
          ? `Share so ${candidate} can sign the offer on OpenSeat.`
          : "Share so the candidate can sign the offer on OpenSeat."}
      </Text>
      <HStack gap={2} vAlign="end" wrap="wrap">
        <TextInput label="E-sign link" value={display} onChange={() => undefined} isReadOnly />
        <Button label="Copy link" variant="secondary" size="sm" onClick={() => void copy()} />
      </HStack>
    </Stack>
  );
}
