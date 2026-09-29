"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banner,
  Badge,
  Button,
  Heading,
  HStack,
  Selector,
  Stack,
  Switch,
  Text,
  TextArea,
  TextInput,
  Token,
} from "@openseat/design-system";
import type { Applicant, TeamMember } from "@/lib/company";
import { formatCents } from "@/lib/money";
import { formatShortDate } from "@/lib/dates";
import {
  OFFER_STATUS_LABEL,
  applyOfferStatus,
  buildOfferPatch,
  canTransitionOffer,
  centsToDollarsInput,
  dollarsToCents,
  emptyOffer,
  newHirePacket,
  offerReadyToHire,
  renderOfferBody,
  scaffoldEsignUrl,
  todayYmd,
  type CompPackage,
  type HirePacket,
  type OfferPatch,
  type OfferRecord,
  type OfferStatus,
  type OfferTemplate,
} from "@/lib/offer-hire";

const NOTE_ROWS = 3;

export type OfferActionResult = {
  applicant: Applicant;
  offer: OfferRecord;
  patch: OfferPatch;
  /** When set, workspace should also move columnId (e.g. hired). */
  columnId?: Applicant["columnId"];
  message: string;
};

export type OfferDraft = {
  offer: OfferRecord;
  baseSalary: string;
  bonus: string;
  signingBonus: string;
};

export function emptyOfferDraft(offer?: OfferRecord | null): OfferDraft {
  const base = offer ?? emptyOffer();
  return {
    offer: base,
    baseSalary: centsToDollarsInput(base.comp?.baseSalaryCents),
    bonus: centsToDollarsInput(base.comp?.bonusCents),
    signingBonus: centsToDollarsInput(base.comp?.signingBonusCents),
  };
}

function mergeComp(draft: OfferDraft): CompPackage {
  return {
    ...(draft.offer.comp ?? {}),
    baseSalaryCents: dollarsToCents(draft.baseSalary),
    bonusCents: dollarsToCents(draft.bonus),
    signingBonusCents: dollarsToCents(draft.signingBonus),
    currency: draft.offer.comp?.currency || "USD",
  };
}

function withComp(draft: OfferDraft): OfferRecord {
  return { ...draft.offer, comp: mergeComp(draft) };
}

/** Offer-stage panel: status, comp, template, approval, e-sign, hire packet. */
export function OfferPanel({
  applicant,
  templates,
  teamMembers,
  onApply,
}: {
  applicant: Applicant;
  templates: OfferTemplate[];
  teamMembers: TeamMember[];
  onApply: (result: OfferActionResult) => void;
}) {
  const [draft, setDraft] = useState<OfferDraft>(() => emptyOfferDraft(applicant.offer));
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(emptyOfferDraft(applicant.offer));
    setActionError(null);
  }, [applicant.id, applicant.offer]);

  const templateOptions = useMemo(
    () => [
      { value: "", label: "No template" },
      ...templates.map((item) => ({ value: item.id, label: item.name })),
    ],
    [templates],
  );

  const selectedTemplate = templates.find((item) => item.id === draft.offer.templateId);
  const status = draft.offer.status;
  const showOfferUi =
    applicant.columnId === "offer" ||
    applicant.columnId === "hired" ||
    applicant.columnId === "interview" ||
    Boolean(applicant.offer);

  if (!showOfferUi) return null;

  const setOffer = (patch: Partial<OfferRecord>) =>
    setDraft((current) => ({ ...current, offer: { ...current.offer, ...patch } }));

  const setCompField = <K extends keyof CompPackage>(key: K, value: CompPackage[K]) =>
    setOffer({ comp: { ...(draft.offer.comp ?? {}), [key]: value } });

  const emit = (nextOffer: OfferRecord, message: string, columnId?: Applicant["columnId"]) => {
    const merged = { ...nextOffer, comp: mergeComp({ ...draft, offer: nextOffer }) };
    onApply({
      // Keep original columnId on applicant so workspace feedback-gate can compare.
      applicant: { ...applicant, offer: merged },
      offer: merged,
      patch: buildOfferPatch(merged),
      columnId,
      message,
    });
  };

  const transition = (to: OfferStatus, message: string, columnId?: Applicant["columnId"]) => {
    const check = canTransitionOffer({
      from: status,
      to,
      requiresApproval: selectedTemplate?.requiresApproval,
    });
    if (!check.ok) {
      setActionError(check.reason);
      return;
    }
    setActionError(null);
    const next = applyOfferStatus(withComp(draft), to, {
      notes: draft.offer.notes,
      expiresAt: draft.offer.expiresAt,
    });
    setDraft((current) => ({ ...current, offer: next }));
    emit(next, message, columnId);
  };

  const saveComp = () => {
    const next = withComp(draft);
    setDraft((current) => ({ ...current, offer: next }));
    emit(next, `Saved offer details for ${applicant.name}`);
  };

  const requestApproval = () => {
    transition("pending_approval", `Approval requested for ${applicant.name}'s offer`);
  };

  const markApproved = () => {
    transition("approved", `Offer for ${applicant.name} approved`);
  };

  const startEsign = () => {
    const next: OfferRecord = {
      ...withComp(draft),
      esign: {
        status: "pending",
        documentTitle: selectedTemplate?.name || "Offer letter",
        signUrl: scaffoldEsignUrl(applicant.id),
        sentAt: new Date().toISOString(),
      },
    };
    setDraft((current) => ({ ...current, offer: next }));
    emit(next, `First-party e-sign link ready for ${applicant.name}`);
  };

  const markEsignSigned = () => {
    const next: OfferRecord = {
      ...withComp(draft),
      esign: {
        ...(draft.offer.esign ?? { status: "pending" }),
        status: "signed",
        signedAt: new Date().toISOString(),
      },
    };
    setDraft((current) => ({ ...current, offer: next }));
    emit(next, `${applicant.name} marked as signed (first-party)`);
  };

  const generateHirePacket = () => {
    const packet: HirePacket = newHirePacket({
      startDate: draft.offer.comp?.startDate || todayYmd(),
      ownerNote: draft.offer.notes,
      status: "ready",
    });
    const next: OfferRecord = { ...withComp(draft), hirePacket: packet };
    setDraft((current) => ({ ...current, offer: next }));
    emit(next, `Hire packet drafted for ${applicant.name}`);
  };

  const toggleChecklistItem = (id: string) => {
    const packet = draft.offer.hirePacket;
    if (!packet) return;
    const checklist = packet.checklist.map((item) =>
      item.id === id
        ? { ...item, status: item.status === "done" ? ("todo" as const) : ("done" as const) }
        : item,
    );
    setOffer({ hirePacket: { ...packet, checklist } });
  };

  const markHired = () => {
    if (!offerReadyToHire(draft.offer) && status !== "accepted") {
      setActionError("Mark the offer accepted before moving to Hired.");
      return;
    }
    setActionError(null);
    const next = applyOfferStatus(withComp(draft), "accepted");
    const packet =
      next.hirePacket && next.hirePacket.status !== "none"
        ? next.hirePacket
        : newHirePacket({
            startDate: next.comp?.startDate || todayYmd(),
            status: "ready",
          });
    const hiredOffer = { ...next, hirePacket: packet };
    setDraft((current) => ({ ...current, offer: hiredOffer }));
    emit(hiredOffer, `${applicant.name} hired — handoff checklist ready`, "hired");
  };

  const previewBody = selectedTemplate
    ? renderOfferBody(selectedTemplate, {
        name: applicant.name,
        role: applicant.jobTitle,
      })
    : null;

  const approvalApprovers = (draft.offer.approval?.approverIds ?? [])
    .map((id) => teamMembers.find((member) => member.id === id)?.name || id)
    .filter(Boolean);

  return (
    <Stack gap={4}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
        <Heading level={3}>Offer</Heading>
        <Badge label={OFFER_STATUS_LABEL[status]} variant="success" />
      </HStack>

      <Text type="supporting" color="secondary">
        Track sent / accepted / declined, capture comp, and hand off a light hire packet. Einstein
        persists these fields when the offer endpoints land.
      </Text>

      {actionError ? (
        <Banner status="error" title="Offer blocked" description={actionError} />
      ) : null}

      <Selector
        label="Template"
        options={templateOptions}
        value={draft.offer.templateId ?? ""}
        onChange={(value) => {
          const template = templates.find((item) => item.id === value);
          setDraft((current) => ({
            ...current,
            offer: {
              ...current.offer,
              templateId: value || undefined,
              comp: template?.defaultComp
                ? { ...(current.offer.comp ?? {}), ...template.defaultComp }
                : current.offer.comp,
            },
            baseSalary: centsToDollarsInput(
              template?.defaultComp?.baseSalaryCents ?? current.offer.comp?.baseSalaryCents,
            ),
            bonus: centsToDollarsInput(
              template?.defaultComp?.bonusCents ?? current.offer.comp?.bonusCents,
            ),
            signingBonus: centsToDollarsInput(
              template?.defaultComp?.signingBonusCents ?? current.offer.comp?.signingBonusCents,
            ),
          }));
        }}
      />

      {selectedTemplate ? (
        <HStack gap={2} wrap="wrap">
          {selectedTemplate.requiresApproval ? (
            <Badge label="Requires approval" variant="warning" />
          ) : null}
          {selectedTemplate.requiresEsign ? <Badge label="Requires e-sign" variant="info" /> : null}
        </HStack>
      ) : null}

      {previewBody ? (
        <Stack gap={1}>
          <Text type="label">Letter preview</Text>
          <Text type="supporting" color="secondary">
            {previewBody.slice(0, 320)}
            {previewBody.length > 320 ? "…" : ""}
          </Text>
        </Stack>
      ) : null}

      <Stack gap={3}>
        <Text type="label">Compensation</Text>
        <HStack gap={2} wrap="wrap">
          <TextInput
            label="Base salary ($)"
            value={draft.baseSalary}
            onChange={(baseSalary) => setDraft((current) => ({ ...current, baseSalary }))}
            placeholder="150000"
          />
          <TextInput
            label="Bonus ($)"
            value={draft.bonus}
            onChange={(bonus) => setDraft((current) => ({ ...current, bonus }))}
            placeholder="15000"
          />
          <TextInput
            label="Signing bonus ($)"
            value={draft.signingBonus}
            onChange={(signingBonus) => setDraft((current) => ({ ...current, signingBonus }))}
            placeholder="10000"
          />
        </HStack>
        <TextInput
          label="Equity note"
          value={draft.offer.comp?.equityNote ?? ""}
          onChange={(equityNote) => setCompField("equityNote", equityNote || undefined)}
          placeholder="0.15% over 4 years"
        />
        <TextInput
          label="Proposed start (YYYY-MM-DD)"
          value={draft.offer.comp?.startDate ?? ""}
          onChange={(startDate) => setCompField("startDate", startDate || undefined)}
          placeholder={todayYmd()}
        />
        <TextInput
          label="Offer expires (YYYY-MM-DD)"
          value={draft.offer.expiresAt ?? ""}
          onChange={(expiresAt) => setOffer({ expiresAt: expiresAt || undefined })}
          placeholder={todayYmd()}
        />
        <TextArea
          label="Offer notes"
          value={draft.offer.notes ?? ""}
          onChange={(notes) => setOffer({ notes })}
          rows={NOTE_ROWS}
          placeholder="Relocation, visa, competing offer, negotiation notes…"
        />
        <Button label="Save offer details" variant="secondary" onClick={saveComp} />
        {draft.offer.comp?.baseSalaryCents !== undefined ? (
          <Text type="supporting" color="secondary">
            Base {formatCents(draft.offer.comp.baseSalaryCents, draft.offer.comp.currency || "USD")}
            {draft.offer.sentAt ? ` · Sent ${formatShortDate(new Date(draft.offer.sentAt))}` : ""}
            {draft.offer.respondedAt
              ? ` · Responded ${formatShortDate(new Date(draft.offer.respondedAt))}`
              : ""}
          </Text>
        ) : null}
      </Stack>

      <Stack gap={2}>
        <Text type="label">Status actions</Text>
        <HStack gap={2} wrap="wrap">
          <Button
            label="Mark sent"
            variant="secondary"
            onClick={() => transition("sent", `Offer sent to ${applicant.name}`)}
          />
          <Button
            label="Mark accepted"
            variant="secondary"
            onClick={() => transition("accepted", `${applicant.name} accepted the offer`)}
          />
          <Button
            label="Mark declined"
            variant="ghost"
            onClick={() => transition("declined", `${applicant.name} declined the offer`)}
          />
          <Button label="Mark hired" variant="primary" onClick={markHired} />
        </HStack>
      </Stack>

      <Stack gap={2}>
        <Text type="label">Approvals (light)</Text>
        <Text type="supporting" color="secondary">
          Internal approve/reject only — no external workflow engine yet.
        </Text>
        {draft.offer.approval ? (
          <HStack gap={2} wrap="wrap" vAlign="center">
            <Badge
              label={draft.offer.approval.status}
              variant={
                draft.offer.approval.status === "approved"
                  ? "success"
                  : draft.offer.approval.status === "rejected"
                    ? "error"
                    : "warning"
              }
            />
            {approvalApprovers.map((name) => (
              <Token key={name} label={name} size="sm" />
            ))}
          </HStack>
        ) : null}
        <HStack gap={2} wrap="wrap">
          <Button label="Request approval" variant="secondary" onClick={requestApproval} />
          <Button label="Mark approved" variant="secondary" onClick={markApproved} />
        </HStack>
      </Stack>

      <Stack gap={2}>
        <Text type="label">E-sign (first-party)</Text>
        <Text type="supporting" color="secondary">
          OpenSeat-hosted sign link only. DocuSign and other connectors are out of scope.
        </Text>
        {draft.offer.esign && draft.offer.esign.status !== "none" ? (
          <HStack gap={2} wrap="wrap" vAlign="center">
            <Badge label={draft.offer.esign.status} variant="info" />
            {draft.offer.esign.signUrl ? (
              <Text type="supporting" color="secondary" maxLines={1}>
                {draft.offer.esign.signUrl}
              </Text>
            ) : null}
          </HStack>
        ) : null}
        <HStack gap={2} wrap="wrap">
          <Button label="Create sign link" variant="secondary" onClick={startEsign} />
          <Button label="Mark signed" variant="ghost" onClick={markEsignSigned} />
        </HStack>
      </Stack>

      <Stack gap={2}>
        <Text type="label">Hire packet / onboarding handoff</Text>
        <Text type="supporting" color="secondary">
          Light checklist stub — not full HRIS onboarding.
        </Text>
        <Button label="Generate hire packet" variant="secondary" onClick={generateHirePacket} />
        {draft.offer.hirePacket && draft.offer.hirePacket.status !== "none" ? (
          <Stack gap={2}>
            <Badge label={draft.offer.hirePacket.status} variant="purple" />
            {draft.offer.hirePacket.checklist.map((item) => (
              <Switch
                key={item.id}
                label={item.label}
                value={item.status === "done"}
                onChange={() => toggleChecklistItem(item.id)}
              />
            ))}
            <TextInput
              label="Handoff target"
              value={draft.offer.hirePacket.handoffTarget ?? ""}
              onChange={(handoffTarget) =>
                setOffer({
                  hirePacket: {
                    ...draft.offer.hirePacket!,
                    handoffTarget: handoffTarget || undefined,
                  },
                })
              }
              placeholder="hr@company.com or #onboarding"
            />
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}
