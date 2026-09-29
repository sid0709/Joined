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
  Tokenizer,
  createStaticSource,
  type SearchableItem,
} from "@openseat/design-system";
import type { Applicant, TeamMember } from "@/lib/company";
import {
  createHirePacket,
  createOfferEsign,
  decideOfferApproval,
  offerHireErrorMessage,
  requestOfferApproval,
} from "@/lib/company/api";
import { canPermission, currentMemberRole, denialReason, type TeamRole } from "@/lib/rbac";
import { EsignShare } from "@/components/company/offer/esign-share";
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
  markHirePacketStatus,
  newHirePacket,
  offerReadyToHire,
  renderOfferBody,
  todayYmd,
  type CompPackage,
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
  actorRole: actorRoleProp = null,
  onApply,
}: {
  applicant: Applicant;
  templates: OfferTemplate[];
  teamMembers: TeamMember[];
  /** Session hiringRole when known; falls back to the you-row on teamMembers. */
  actorRole?: TeamRole | null;
  onApply: (result: OfferActionResult) => void;
}) {
  const [draft, setDraft] = useState<OfferDraft>(() => emptyOfferDraft(applicant.offer));
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [approverIds, setApproverIds] = useState<string[]>(
    () => applicant.offer?.approval?.approverIds ?? [],
  );
  const [busy, setBusy] = useState(false);

  const actorRole = actorRoleProp ?? currentMemberRole(teamMembers);
  const canDraftOffer = canPermission(actorRole, "offers.draft");
  const canSendOffer = canPermission(actorRole, "offers.send");
  const canApproveOffer = canPermission(actorRole, "offers.approve");
  const canHire = canPermission(actorRole, "offers.hire");
  // Einstein enforces offers.* server-side (403). Soft gates hide unavailable CTAs.

  /* eslint-disable react-hooks/set-state-in-effect -- remount-equivalent reset on applicant/offer change */
  useEffect(() => {
    setDraft(emptyOfferDraft(applicant.offer));
    setActionError(null);
    setApprovalNote(applicant.offer?.approval?.note ?? "");
    setApproverIds(applicant.offer?.approval?.approverIds ?? []);
  }, [applicant.id, applicant.offer]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const templateOptions = useMemo(
    () => [
      { value: "", label: "No template" },
      ...templates.map((item) => ({ value: item.id, label: item.name })),
    ],
    [templates],
  );

  const approverSource = useMemo(
    () =>
      createStaticSource(
        teamMembers.map((member) => ({
          id: member.id,
          label: member.isYou ? `${member.name} (you)` : member.name,
        })),
      ),
    [teamMembers],
  );

  const selectedApprovers: SearchableItem[] = approverIds
    .map((id) => {
      const member = teamMembers.find((item) => item.id === id);
      return member
        ? {
            id: member.id,
            label: member.isYou ? `${member.name} (you)` : member.name,
          }
        : { id, label: id };
    })
    .filter(Boolean);

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
    const check = canTransitionOffer({
      from: status === "pending_approval" ? "pending_approval" : status,
      to: "pending_approval",
      requiresApproval: selectedTemplate?.requiresApproval,
    });
    if (!check.ok && status !== "draft" && status !== "pending_approval") {
      setActionError(check.reason);
      return;
    }
    setActionError(null);
    setBusy(true);
    requestOfferApproval(applicant.id, {
      note: approvalNote || undefined,
      approverIds: approverIds.length ? approverIds : undefined,
    })
      .then((approval) => {
        const next: OfferRecord = {
          ...withComp(draft),
          status: "pending_approval",
          approval: {
            ...approval,
            approverIds: approval.approverIds?.length ? approval.approverIds : approverIds,
            note: approval.note || approvalNote || undefined,
          },
        };
        setDraft((current) => ({ ...current, offer: next }));
        emit(next, `Approval requested for ${applicant.name}'s offer`);
      })
      .catch((error: unknown) => setActionError(offerHireErrorMessage(error)))
      .finally(() => setBusy(false));
  };

  const markApproved = () => {
    const approvalId = draft.offer.approval?.id;
    if (!approvalId) {
      setActionError("Request approval before approving.");
      return;
    }
    setActionError(null);
    setBusy(true);
    decideOfferApproval(applicant.id, approvalId, {
      status: "approved",
      note: approvalNote || undefined,
    })
      .then((approval) => {
        const next: OfferRecord = {
          ...withComp(draft),
          status: "approved",
          approval: {
            ...approval,
            approverIds: approverIds.length ? approverIds : approval.approverIds,
          },
        };
        setDraft((current) => ({ ...current, offer: next }));
        emit(next, `Offer for ${applicant.name} approved`);
      })
      .catch((error: unknown) => setActionError(offerHireErrorMessage(error)))
      .finally(() => setBusy(false));
  };

  const markRejectedApproval = () => {
    const approvalId = draft.offer.approval?.id;
    if (!approvalId) {
      setActionError("Request approval before rejecting.");
      return;
    }
    setActionError(null);
    setBusy(true);
    decideOfferApproval(applicant.id, approvalId, {
      status: "rejected",
      note: approvalNote || undefined,
    })
      .then((approval) => {
        const next: OfferRecord = {
          ...withComp(draft),
          status: "draft",
          approval,
        };
        setDraft((current) => ({ ...current, offer: next }));
        emit(next, `Offer approval rejected for ${applicant.name}`);
      })
      .catch((error: unknown) => setActionError(offerHireErrorMessage(error)))
      .finally(() => setBusy(false));
  };

  const setPacketStatus = (packetStatus: "ready" | "sent") => {
    // ready/sent is FE-local on top of hire-packet POST — no item PATCH from Einstein yet.
    if (!canHire) {
      setActionError(denialReason(actorRole, "offers.hire"));
      return;
    }
    const next = markHirePacketStatus(withComp(draft), packetStatus, {
      handoffTarget: draft.offer.hirePacket?.handoffTarget,
      ownerNote: draft.offer.hirePacket?.ownerNote ?? draft.offer.notes,
    });
    setDraft((current) => ({ ...current, offer: next }));
    emit(
      next,
      packetStatus === "sent"
        ? `Hire packet sent for ${applicant.name}`
        : `Hire packet marked ready for ${applicant.name}`,
    );
  };

  const startEsign = () => {
    setActionError(null);
    setBusy(true);
    createOfferEsign(applicant.id, {
      documentTitle: selectedTemplate?.name || "Offer letter",
    })
      .then((esign) => {
        const next: OfferRecord = { ...withComp(draft), esign };
        setDraft((current) => ({ ...current, offer: next }));
        emit(next, `First-party e-sign link ready for ${applicant.name}`);
      })
      .catch((error: unknown) => setActionError(offerHireErrorMessage(error)))
      .finally(() => setBusy(false));
  };

  const markEsignSigned = () => {
    // Candidate sign-page UX is still FE-later; employer can mark signed locally (no countersign BE).
    if (!canSendOffer) {
      setActionError(denialReason(actorRole, "offers.send"));
      return;
    }
    if (!draft.offer.esign || draft.offer.esign.status === "none") {
      setActionError("Create a sign link before marking signed.");
      return;
    }
    const next: OfferRecord = {
      ...withComp(draft),
      esign: {
        ...draft.offer.esign,
        status: "signed",
        signedAt: new Date().toISOString(),
      },
    };
    setDraft((current) => ({ ...current, offer: next }));
    emit(next, `${applicant.name} marked as signed (first-party)`);
  };

  const markEsignDeclined = () => {
    if (!canSendOffer) {
      setActionError(denialReason(actorRole, "offers.send"));
      return;
    }
    if (!draft.offer.esign || draft.offer.esign.status === "none") {
      setActionError("Create a sign link before marking declined.");
      return;
    }
    const next: OfferRecord = {
      ...withComp(draft),
      esign: {
        ...draft.offer.esign,
        status: "declined",
      },
    };
    setDraft((current) => ({ ...current, offer: next }));
    emit(next, `${applicant.name} declined e-sign`);
  };

  const generateHirePacket = () => {
    setActionError(null);
    setBusy(true);
    createHirePacket(applicant.id, {
      startDate: draft.offer.comp?.startDate || todayYmd(),
      ownerNote: draft.offer.notes,
      handoffTarget: draft.offer.hirePacket?.handoffTarget,
      resetChecklist: true,
    })
      .then((packet) => {
        const next: OfferRecord = { ...withComp(draft), hirePacket: packet };
        setDraft((current) => ({ ...current, offer: next }));
        emit(next, `Hire packet drafted for ${applicant.name}`);
      })
      .catch((error: unknown) => setActionError(offerHireErrorMessage(error)))
      .finally(() => setBusy(false));
  };

  const toggleChecklistItem = (id: string) => {
    // Checklist toggles are FE-local until Einstein hire-packet item PATCH lands.
    if (!canHire) {
      setActionError(denialReason(actorRole, "offers.hire"));
      return;
    }
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

      {!canDraftOffer && !canSendOffer && !canHire && !canApproveOffer ? (
        <Banner
          status="warning"
          title="View only"
          description={denialReason(actorRole, "offers.draft")}
        />
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
        <HStack gap={2} wrap="wrap">
          <TextInput
            label="Currency"
            value={draft.offer.comp?.currency ?? "USD"}
            onChange={(currency) => setCompField("currency", currency.toUpperCase() || "USD")}
            placeholder="USD"
          />
        </HStack>
        <TextArea
          label="Comp package notes"
          value={draft.offer.comp?.notes ?? ""}
          onChange={(notes) => setCompField("notes", notes || undefined)}
          rows={2}
          placeholder="Band, leveling, relocation stipend, benefits callouts…"
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
        <Button
          label="Save offer details"
          variant="secondary"
          onClick={saveComp}
          isDisabled={!canDraftOffer}
        />
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
            isDisabled={!canSendOffer}
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
          <Button label="Mark hired" variant="primary" onClick={markHired} isDisabled={!canHire} />
        </HStack>
      </Stack>

      <Stack gap={2}>
        <Text type="label">Approvals (light)</Text>
        <Text type="supporting" color="secondary">
          Internal approve/reject only — no external workflow engine yet.
        </Text>
        <Tokenizer
          label="Approvers"
          description="Who must sign off before this offer can go out."
          searchSource={approverSource}
          value={selectedApprovers}
          onChange={(next) => setApproverIds(next.map((item) => item.id))}
          hasEntriesOnFocus
          placeholder={teamMembers.length ? "Add an approver" : "Load team to assign"}
        />
        <TextArea
          label="Approval note"
          value={approvalNote}
          onChange={setApprovalNote}
          rows={2}
          placeholder="Why this package, exceptions, competing offer…"
        />
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
          <Button
            label="Request approval"
            variant="secondary"
            onClick={requestApproval}
            isDisabled={busy || !canDraftOffer}
          />
          <Button
            label="Mark approved"
            variant="secondary"
            onClick={markApproved}
            isDisabled={busy || !canApproveOffer}
          />
          <Button
            label="Reject approval"
            variant="ghost"
            onClick={markRejectedApproval}
            isDisabled={busy || !canApproveOffer}
          />
        </HStack>
      </Stack>

      <Stack gap={2}>
        <Text type="label">E-sign (first-party)</Text>
        <Text type="supporting" color="secondary">
          OpenSeat-hosted sign link only. DocuSign is out of scope. Mark signed / declined is
          employer-local until candidate countersign lands.
        </Text>
        {draft.offer.esign && draft.offer.esign.status !== "none" ? (
          <Badge label={draft.offer.esign.status} variant="info" />
        ) : null}
        <EsignShare
          applicantId={applicant.id}
          url={draft.offer.esign?.signUrl}
          candidate={applicant.name}
        />
        <HStack gap={2} wrap="wrap">
          <Button
            label="Create sign link"
            variant="secondary"
            onClick={startEsign}
            isDisabled={busy || !canSendOffer}
          />
          <Button
            label="Mark signed"
            variant="ghost"
            onClick={markEsignSigned}
            isDisabled={
              busy || !canSendOffer || !draft.offer.esign || draft.offer.esign.status === "none"
            }
          />
          <Button
            label="Mark e-sign declined"
            variant="ghost"
            onClick={markEsignDeclined}
            isDisabled={
              busy || !canSendOffer || !draft.offer.esign || draft.offer.esign.status === "none"
            }
          />
        </HStack>
      </Stack>

      <Stack gap={2}>
        <Text type="label">Hire packet / onboarding handoff</Text>
        <Text type="supporting" color="secondary">
          Light checklist stub — not full HRIS onboarding. Ready / sent / checklist toggles stay
          local until Einstein hire-packet item PATCH lands; Generate still posts a draft.
        </Text>
        <HStack gap={2} wrap="wrap">
          <Button
            label="Generate hire packet"
            variant="secondary"
            onClick={generateHirePacket}
            isDisabled={busy || (!canHire && !canDraftOffer)}
          />
          <Button
            label="Mark ready"
            variant="secondary"
            onClick={() => setPacketStatus("ready")}
            isDisabled={!canHire}
          />
          <Button
            label="Mark sent to HR"
            variant="ghost"
            onClick={() => setPacketStatus("sent")}
            isDisabled={!canHire}
          />
        </HStack>
        {draft.offer.hirePacket && draft.offer.hirePacket.status !== "none" ? (
          <Stack gap={2}>
            <Badge label={draft.offer.hirePacket.status} variant="purple" />
            {draft.offer.hirePacket.checklist.map((item) => (
              <Switch
                key={item.id}
                label={item.label}
                value={item.status === "done"}
                onChange={() => toggleChecklistItem(item.id)}
                isDisabled={!canHire}
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
              isDisabled={!canHire}
            />
            <TextArea
              label="Owner note for HR"
              value={draft.offer.hirePacket.ownerNote ?? ""}
              onChange={(ownerNote) =>
                setOffer({
                  hirePacket: {
                    ...draft.offer.hirePacket!,
                    ownerNote: ownerNote || undefined,
                  },
                })
              }
              rows={2}
              placeholder="Start date flexibility, equipment, buddy assignment…"
              isDisabled={!canHire}
            />
            <Button
              label="Save handoff notes"
              variant="secondary"
              onClick={() => emit(withComp(draft), `Hire handoff saved for ${applicant.name}`)}
            />
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}
