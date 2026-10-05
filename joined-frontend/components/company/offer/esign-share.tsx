"use client";

import { Banner, Button, HStack, Stack, Text, TextInput, useToast } from "sid-ui";
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
        body: live
          ? "E-sign link copied."
          : "Preview link copied — create a sign link to mint the live URL.",
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
          description="Use Create sign link to mint a first-party Joined URL (/offer/sign/:applicantId). No DocuSign."
        />
      ) : null}
      <Text type="supporting" color="secondary">
        {candidate
          ? `Share so ${candidate} can sign the offer on Joined.`
          : "Share so the candidate can sign the offer on Joined."}
      </Text>
      <HStack gap={2} vAlign="end" wrap="wrap">
        <TextInput label="E-sign link" value={display} onChange={() => undefined} isReadOnly />
        <Button label="Copy link" variant="secondary" size="sm" onClick={() => void copy()} />
      </HStack>
    </Stack>
  );
}
