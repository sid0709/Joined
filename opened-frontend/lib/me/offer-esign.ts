import { CompanyRequestError, meGet, meSend } from "@/lib/me/client";
import { type EsignMarkInput, hydrateOfferEsign, type OfferEsign } from "@/lib/offer-hire";

function asEsign(raw: OfferEsign): OfferEsign {
  const esign = hydrateOfferEsign(raw);
  if (!esign) throw new CompanyRequestError("Invalid e-sign response", 500);
  return esign;
}

/** GET /v1/me/applications/:id/offer/esign — the signed-in applicant only. */
export function fetchMyOfferEsign(applicationId: string) {
  return meGet<OfferEsign>(`/applications/${encodeURIComponent(applicationId)}/offer/esign`).then(
    asEsign,
  );
}

/** POST /v1/me/applications/:id/offer/esign — candidate countersign or decline. */
export function respondMyOfferEsign(applicationId: string, body: EsignMarkInput) {
  return meSend<OfferEsign>(
    `/applications/${encodeURIComponent(applicationId)}/offer/esign`,
    "POST",
    body,
  ).then(asEsign);
}
