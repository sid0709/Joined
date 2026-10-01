package employer

import (
	"bytes"
	"encoding/json"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/joined-backend/internal/candidate"
)

// Limits and copy match joined-frontend/lib/offer-hire.ts.

const (
	maxOfferTemplates    = 8
	maxOfferNotes        = 2000
	maxEquityNote        = 280
	maxCompNotes         = 500
	maxOfferTemplateName = 120
	maxOfferTemplateBody = 8000
	maxTemplateID        = 80
	maxDocumentTitle     = 200
	maxHandoffTarget     = 200
	maxApprovers         = 12
	maxApproverID        = 80
	maxDecidedBy         = 120
	maxCurrencyLen       = 8
	defaultOfferCurrency = "USD"
	offerSignPath        = "/offer/sign/"
	defaultOfferOrigin   = "https://joined.app"
)

var ymdPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

var defaultHireLabels = []string{
	"Send welcome email",
	"Collect payroll / tax forms",
	"Provision laptop & accounts",
	"Schedule day-one orientation",
	"Add to team channels",
}

var offerStatusLabel = map[string]string{
	candidate.OfferDraft:           "Draft",
	candidate.OfferPendingApproval: "Pending approval",
	candidate.OfferApproved:        "Approved",
	candidate.OfferSent:            "Sent",
	candidate.OfferAccepted:        "Accepted",
	candidate.OfferDeclined:        "Declined",
	candidate.OfferExpired:         "Expired",
	candidate.OfferWithdrawn:       "Withdrawn",
}

var offerTransitions = map[string][]string{
	candidate.OfferDraft:           {candidate.OfferPendingApproval, candidate.OfferApproved, candidate.OfferSent, candidate.OfferWithdrawn},
	candidate.OfferPendingApproval: {candidate.OfferApproved, candidate.OfferDraft, candidate.OfferWithdrawn},
	candidate.OfferApproved:        {candidate.OfferSent, candidate.OfferWithdrawn, candidate.OfferDraft},
	candidate.OfferSent:            {candidate.OfferAccepted, candidate.OfferDeclined, candidate.OfferExpired, candidate.OfferWithdrawn},
	candidate.OfferAccepted:        {candidate.OfferAccepted},
	candidate.OfferDeclined:        {candidate.OfferDraft, candidate.OfferWithdrawn},
	candidate.OfferExpired:         {candidate.OfferDraft, candidate.OfferSent, candidate.OfferWithdrawn},
	candidate.OfferWithdrawn:       {candidate.OfferDraft},
}

// offerInputError is a 400 whose message is safe to show in the hiring UI.
type offerInputError struct{ reason string }

func (e *offerInputError) Error() string { return e.reason }

func (e *offerInputError) Unwrap() error { return ErrInvalidInput }

func offerInput(reason string) error { return &offerInputError{reason: reason} }

// ApprovalRequest is POST /v1/company/applicants/:id/offer/approvals.
type ApprovalRequest struct {
	Note        *string  `json:"note"`
	ApproverIDs []string `json:"approverIds"`
}

// ApprovalDecision is PATCH /v1/company/applicants/:id/offer/approvals/:approvalId.
type ApprovalDecision struct {
	Status string  `json:"status"`
	Note   *string `json:"note"`
}

// EsignInput is POST /v1/company/applicants/:id/offer/esign.
type EsignInput struct {
	DocumentTitle string `json:"documentTitle"`
}

// EsignMarkInput is the candidate and employer e-sign response.
// Employer: POST /v1/company/applicants/:id/offer/esign/mark (offers.send).
// Candidate: POST /v1/me/applications/:id/offer/esign (the applicant only).
type EsignMarkInput struct {
	Status string `json:"status"`
}

// HirePacketInput is POST /v1/company/applicants/:id/hire-packet.
type HirePacketInput struct {
	StartDate      string `json:"startDate"`
	OwnerNote      string `json:"ownerNote"`
	HandoffTarget  string `json:"handoffTarget"`
	ResetChecklist *bool  `json:"resetChecklist"`
}

// HirePacketStatusInput is PATCH /v1/company/applicants/:id/hire-packet.
// Status is ready or sent. Omitted notes stay as stored; a present string replaces them.
type HirePacketStatusInput struct {
	Status        string  `json:"status"`
	OwnerNote     *string `json:"ownerNote"`
	HandoffTarget *string `json:"handoffTarget"`
}

// HirePacketItemInput is PATCH /v1/company/applicants/:id/hire-packet/items/:itemId.
// Status is todo (undone), done, or skipped.
type HirePacketItemInput struct {
	Status string `json:"status"`
}

type offerPatchWire struct {
	Status      json.RawMessage `json:"status"`
	TemplateID  json.RawMessage `json:"templateId"`
	SentAt      json.RawMessage `json:"sentAt"`
	RespondedAt json.RawMessage `json:"respondedAt"`
	ExpiresAt   json.RawMessage `json:"expiresAt"`
	Notes       json.RawMessage `json:"notes"`
	Comp        json.RawMessage `json:"comp"`
}

func (w offerPatchWire) touched() bool {
	return w.Status != nil || w.TemplateID != nil || w.SentAt != nil || w.RespondedAt != nil || w.ExpiresAt != nil || w.Notes != nil || w.Comp != nil
}

func offerPatchPresent(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null"))
}

func validOfferStatus(status string) bool {
	_, ok := offerStatusLabel[status]
	return ok
}

// mergeApplicantOffer applies OfferPatch and the column rules from offer-hire.ts.
// write is false when the stored offer should stay as it is.
func mergeApplicantOffer(current *candidate.OfferRecord, raw json.RawMessage, columnID, fromColumn string, templates []candidate.OfferTemplate, now time.Time) (*candidate.OfferRecord, bool, error) {
	wire, hasWire, err := decodeOfferPatch(raw)
	if err != nil {
		return nil, false, err
	}
	statusSet := false
	requested := ""
	if hasWire && wire.Status != nil {
		requested, err = parseOfferStatus(wire.Status)
		if err != nil {
			return nil, false, err
		}
		statusSet = true
	}

	from := candidate.OfferDraft
	if current != nil && current.Status != "" {
		from = current.Status
	}
	movingToOffer := columnID == stageOffer && fromColumn != stageOffer
	// Status omitted while landing on Offer becomes draft. An explicit status wins.
	forceDraft := columnID == stageOffer && !statusSet && (current == nil || current.Status == "" || movingToOffer)

	final := from
	if statusSet {
		final = requested
	}
	if columnID == stageHired {
		final = candidate.OfferAccepted
	} else if forceDraft {
		final = candidate.OfferDraft
	}

	need := hasWire && wire.touched() || final != from
	if current == nil && (columnID == stageHired || (columnID == stageOffer && !statusSet)) {
		need = true
	}
	if !need {
		return current, false, nil
	}

	next := cloneOffer(current)
	if next == nil {
		next = emptyOffer()
	}
	if hasWire {
		if err := applyOfferFields(next, wire); err != nil {
			return nil, false, err
		}
	}
	if final != from {
		forced := (columnID == stageHired && final == candidate.OfferAccepted) || (forceDraft && final == candidate.OfferDraft)
		if !forced {
			if err := checkOfferTransition(from, final, templateRequiresApproval(templates, next.TemplateID)); err != nil {
				return nil, false, err
			}
		}
		if final == candidate.OfferSent || final == candidate.OfferAccepted || final == candidate.OfferDeclined {
			stampOfferStatus(next, final, now)
		} else {
			next.Status = final
		}
	}
	if next.Status == "" {
		next.Status = candidate.OfferDraft
	}
	return next, true, nil
}

func emptyOffer() *candidate.OfferRecord {
	return &candidate.OfferRecord{
		Status: candidate.OfferDraft,
		Comp:   &candidate.CompPackage{Currency: defaultOfferCurrency},
	}
}

func decodeOfferPatch(raw json.RawMessage) (offerPatchWire, bool, error) {
	if !offerPatchPresent(raw) {
		return offerPatchWire{}, false, nil
	}
	var wire offerPatchWire
	if err := json.Unmarshal(raw, &wire); err != nil {
		return offerPatchWire{}, false, offerInput("Offer patch is invalid.")
	}
	return wire, true, nil
}

func parseOfferStatus(raw json.RawMessage) (string, error) {
	if rawNull(raw) {
		return "", offerInput("Offer status is invalid.")
	}
	var status string
	if err := json.Unmarshal(raw, &status); err != nil || !validOfferStatus(status) {
		return "", offerInput("Offer status is invalid.")
	}
	return status, nil
}

func applyOfferFields(next *candidate.OfferRecord, wire offerPatchWire) error {
	if wire.TemplateID != nil {
		value, clear, err := parseNullableString(wire.TemplateID)
		if err != nil {
			return offerInput("Offer template is invalid.")
		}
		if clear {
			next.TemplateID = ""
		} else {
			next.TemplateID = clip(value, maxTemplateID)
		}
	}
	if wire.Notes != nil {
		value, clear, err := parseNullableString(wire.Notes)
		if err != nil {
			return offerInput("Offer notes are invalid.")
		}
		if clear {
			next.Notes = ""
		} else {
			next.Notes = clip(value, maxOfferNotes)
		}
	}
	if wire.ExpiresAt != nil {
		value, clear, err := parseNullableString(wire.ExpiresAt)
		if err != nil {
			return offerInput("Expiry must be YYYY-MM-DD.")
		}
		if clear || strings.TrimSpace(value) == "" {
			next.ExpiresAt = ""
		} else if !ymdPattern.MatchString(strings.TrimSpace(value)) {
			return offerInput("Expiry must be YYYY-MM-DD.")
		} else {
			next.ExpiresAt = strings.TrimSpace(value)
		}
	}
	if wire.SentAt != nil {
		when, clear, err := parseNullableTime(wire.SentAt, "Sent time is invalid.")
		if err != nil {
			return err
		}
		if clear {
			next.SentAt = nil
		} else {
			next.SentAt = when
		}
	}
	if wire.RespondedAt != nil {
		when, clear, err := parseNullableTime(wire.RespondedAt, "Response time is invalid.")
		if err != nil {
			return err
		}
		if clear {
			next.RespondedAt = nil
		} else {
			next.RespondedAt = when
		}
	}
	if wire.Comp != nil {
		if rawNull(wire.Comp) {
			next.Comp = nil
			return nil
		}
		var comp candidate.CompPackage
		if err := json.Unmarshal(wire.Comp, &comp); err != nil {
			return offerInput("Compensation is invalid.")
		}
		normalized, err := normalizeComp(&comp)
		if err != nil {
			return err
		}
		next.Comp = normalized
	}
	return nil
}

func parseNullableString(raw json.RawMessage) (string, bool, error) {
	if rawNull(raw) {
		return "", true, nil
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", false, err
	}
	return value, false, nil
}

func parseNullableTime(raw json.RawMessage, invalid string) (*time.Time, bool, error) {
	if rawNull(raw) {
		return nil, true, nil
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, false, offerInput(invalid)
	}
	if strings.TrimSpace(value) == "" {
		return nil, true, nil
	}
	when, ok := parseOfferTime(value)
	if !ok {
		return nil, false, offerInput(invalid)
	}
	return &when, false, nil
}

func parseOfferTime(raw string) (time.Time, bool) {
	raw = strings.TrimSpace(raw)
	if ymdPattern.MatchString(raw) {
		when, err := time.Parse("2006-01-02", raw)
		return when.UTC(), err == nil
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339} {
		when, err := time.Parse(layout, raw)
		if err == nil {
			return when.UTC(), true
		}
	}
	return time.Time{}, false
}

func checkOfferTransition(from, to string, requiresApproval bool) error {
	if from == to {
		return nil
	}
	if to == candidate.OfferSent && requiresApproval && from != candidate.OfferApproved && from != candidate.OfferSent {
		return offerInput("Get approval before sending this offer.")
	}
	if !stringListed(offerTransitions[from], to) {
		fromLabel := offerStatusLabel[from]
		toLabel := offerStatusLabel[to]
		if fromLabel == "" {
			fromLabel = from
		}
		if toLabel == "" {
			toLabel = to
		}
		return offerInput("Cannot move offer from " + fromLabel + " to " + toLabel + ".")
	}
	return nil
}

func stringListed(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func templateRequiresApproval(templates []candidate.OfferTemplate, id string) bool {
	if id == "" {
		return false
	}
	for _, item := range templates {
		if item.ID == id {
			return item.RequiresApproval
		}
	}
	return false
}

func stampOfferStatus(offer *candidate.OfferRecord, status string, now time.Time) {
	offer.Status = status
	iso := now.UTC()
	switch status {
	case candidate.OfferSent:
		sent := iso
		offer.SentAt = &sent
		offer.RespondedAt = nil
	case candidate.OfferAccepted, candidate.OfferDeclined:
		responded := iso
		offer.RespondedAt = &responded
		if offer.SentAt == nil {
			sent := iso
			offer.SentAt = &sent
		}
	}
}

func requestOfferApproval(current *candidate.OfferRecord, input ApprovalRequest, now time.Time) (*candidate.OfferRecord, candidate.OfferApproval, error) {
	from := candidate.OfferDraft
	if current != nil && current.Status != "" {
		from = current.Status
	}
	if from != candidate.OfferPendingApproval {
		if err := checkOfferTransition(from, candidate.OfferPendingApproval, false); err != nil {
			return nil, candidate.OfferApproval{}, err
		}
	}
	next := cloneOffer(current)
	if next == nil {
		next = emptyOffer()
	}
	approval := candidate.OfferApproval{Status: candidate.OfferApprovalPending, RequestedAt: now.UTC()}
	if next.Approval != nil && next.Approval.ID != "" {
		approval.ID = next.Approval.ID
		approval.ApproverIDs = append([]string(nil), next.Approval.ApproverIDs...)
		approval.Note = next.Approval.Note
	} else {
		id, err := prefixedID("oapr")
		if err != nil {
			return nil, candidate.OfferApproval{}, err
		}
		approval.ID = id
	}
	if input.Note != nil {
		approval.Note = clip(*input.Note, maxOfferNotes)
	}
	if input.ApproverIDs != nil {
		approval.ApproverIDs = normalizeApproverIDs(input.ApproverIDs)
	}
	next.Status = candidate.OfferPendingApproval
	next.Approval = &approval
	return next, approval, nil
}

func decideOfferApproval(current *candidate.OfferRecord, approvalID string, input ApprovalDecision, actorID string, now time.Time) (*candidate.OfferRecord, candidate.OfferApproval, error) {
	if current == nil || current.Approval == nil || current.Approval.ID == "" || current.Approval.ID != approvalID {
		return nil, candidate.OfferApproval{}, ErrNotFound
	}
	if input.Status != candidate.OfferApprovalApproved && input.Status != candidate.OfferApprovalRejected {
		return nil, candidate.OfferApproval{}, offerInput("Approval status must be approved or rejected.")
	}
	next := cloneOffer(current)
	approval := *next.Approval
	approval.ApproverIDs = append([]string(nil), next.Approval.ApproverIDs...)
	approval.Status = input.Status
	approval.DecidedAt = now.UTC()
	approval.DecidedBy = clip(actorID, maxDecidedBy)
	if input.Note != nil {
		approval.Note = clip(*input.Note, maxOfferNotes)
	}
	next.Approval = &approval
	if input.Status == candidate.OfferApprovalApproved {
		next.Status = candidate.OfferApproved
	} else {
		next.Status = candidate.OfferDraft
	}
	return next, approval, nil
}

func mintOfferEsign(current *candidate.OfferRecord, applicantID, origin, title string, now time.Time) (*candidate.OfferRecord, candidate.OfferEsign, error) {
	next := cloneOffer(current)
	if next == nil {
		next = emptyOffer()
	}
	if next.Status == "" {
		next.Status = candidate.OfferDraft
	}
	esign := candidate.OfferEsign{Status: candidate.OfferEsignPending}
	if next.Esign != nil {
		esign = *next.Esign
	}
	esign.Status = candidate.OfferEsignPending
	esign.SignedAt = nil
	esign.SignURL = offerSignURL(origin, applicantID)
	if esign.SignURL == "" {
		return nil, candidate.OfferEsign{}, offerInput("Could not mint a sign link.")
	}
	sent := now.UTC()
	esign.SentAt = &sent
	if trimmed := clip(title, maxDocumentTitle); trimmed != "" {
		esign.DocumentTitle = trimmed
	}
	next.Esign = &esign
	return next, esign, nil
}

// markOfferEsign records signed or declined on an existing first-party sign link.
// Offer status is left alone. Decline keeps a previous signedAt.
func markOfferEsign(current *candidate.OfferRecord, status string, now time.Time) (*candidate.OfferRecord, candidate.OfferEsign, error) {
	status = strings.TrimSpace(status)
	if status != candidate.OfferEsignSigned && status != candidate.OfferEsignDeclined {
		return nil, candidate.OfferEsign{}, offerInput("E-sign status must be signed or declined.")
	}
	if current == nil || current.Esign == nil || current.Esign.Status == "" || current.Esign.Status == candidate.OfferEsignNone {
		if status == candidate.OfferEsignDeclined {
			return nil, candidate.OfferEsign{}, offerInput("Create a sign link before marking declined.")
		}
		return nil, candidate.OfferEsign{}, offerInput("Create a sign link before marking signed.")
	}
	next := cloneOffer(current)
	if next.Status == "" {
		next.Status = candidate.OfferDraft
	}
	esign := *next.Esign
	esign.Status = status
	if status == candidate.OfferEsignSigned {
		signed := now.UTC()
		esign.SignedAt = &signed
	}
	next.Esign = &esign
	return next, esign, nil
}

// esignView is the stored link, or status none when the offer has no e-sign yet.
func esignView(current *candidate.OfferRecord) candidate.OfferEsign {
	if current == nil || current.Esign == nil || current.Esign.Status == "" {
		return candidate.OfferEsign{Status: candidate.OfferEsignNone}
	}
	esign := *current.Esign
	esign.SentAt = cloneTime(current.Esign.SentAt)
	esign.SignedAt = cloneTime(current.Esign.SignedAt)
	return esign
}

func offerSignURL(origin, applicantID string) string {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin == "" {
		origin = defaultOfferOrigin
	}
	if applicantID == "" {
		return ""
	}
	return origin + offerSignPath + url.PathEscape(applicantID)
}

func upsertHirePacket(current *candidate.OfferRecord, input HirePacketInput, now time.Time) (*candidate.OfferRecord, candidate.HirePacket, error) {
	start := strings.TrimSpace(input.StartDate)
	if start != "" && !ymdPattern.MatchString(start) {
		return nil, candidate.HirePacket{}, offerInput("Start date must be YYYY-MM-DD.")
	}
	next := cloneOffer(current)
	if next == nil {
		next = emptyOffer()
	}
	var packet candidate.HirePacket
	if next.HirePacket != nil && next.HirePacket.Status != "" && next.HirePacket.Status != candidate.HirePacketNone {
		packet = *next.HirePacket
		packet.Checklist = append([]candidate.HirePacketItem(nil), next.HirePacket.Checklist...)
	} else {
		checklist, err := defaultHireChecklist()
		if err != nil {
			return nil, candidate.HirePacket{}, err
		}
		packet = candidate.HirePacket{Status: candidate.HirePacketDraft, Checklist: checklist, GeneratedAt: now.UTC()}
	}
	if packet.Status == "" || packet.Status == candidate.HirePacketNone {
		packet.Status = candidate.HirePacketDraft
	}
	if packet.GeneratedAt.IsZero() {
		packet.GeneratedAt = now.UTC()
	}
	reset := input.ResetChecklist != nil && *input.ResetChecklist
	if reset || len(packet.Checklist) == 0 {
		checklist, err := defaultHireChecklist()
		if err != nil {
			return nil, candidate.HirePacket{}, err
		}
		packet.Checklist = checklist
	}
	if start != "" {
		packet.StartDate = start
	}
	if note := clip(input.OwnerNote, maxCompNotes); note != "" {
		packet.OwnerNote = note
	}
	if target := clip(input.HandoffTarget, maxHandoffTarget); target != "" {
		packet.HandoffTarget = target
	}
	if packet.Checklist == nil {
		packet.Checklist = []candidate.HirePacketItem{}
	}
	next.HirePacket = &packet
	return next, packet, nil
}

// setHirePacketStatus moves a packet to ready or sent.
// A missing packet gets the default checklist, matching markHirePacketStatus.
func setHirePacketStatus(current *candidate.OfferRecord, input HirePacketStatusInput, now time.Time) (*candidate.OfferRecord, candidate.HirePacket, error) {
	status := strings.TrimSpace(input.Status)
	if status != candidate.HirePacketReady && status != candidate.HirePacketSent {
		return nil, candidate.HirePacket{}, offerInput("Hire packet status must be ready or sent.")
	}
	next := cloneOffer(current)
	if next == nil {
		next = emptyOffer()
	}
	packet, err := packetForStatus(next.HirePacket, status, now)
	if err != nil {
		return nil, candidate.HirePacket{}, err
	}
	if input.OwnerNote != nil {
		packet.OwnerNote = clip(*input.OwnerNote, maxCompNotes)
	}
	if input.HandoffTarget != nil {
		packet.HandoffTarget = clip(*input.HandoffTarget, maxHandoffTarget)
	}
	next.HirePacket = &packet
	return next, packet, nil
}

func packetForStatus(current *candidate.HirePacket, status string, now time.Time) (candidate.HirePacket, error) {
	if current != nil && current.Status != "" && current.Status != candidate.HirePacketNone {
		packet := *current
		packet.Checklist = append([]candidate.HirePacketItem(nil), current.Checklist...)
		if len(packet.Checklist) == 0 {
			checklist, err := defaultHireChecklist()
			if err != nil {
				return candidate.HirePacket{}, err
			}
			packet.Checklist = checklist
		}
		packet.Status = status
		if packet.GeneratedAt.IsZero() {
			packet.GeneratedAt = now.UTC()
		}
		return packet, nil
	}
	checklist, err := defaultHireChecklist()
	if err != nil {
		return candidate.HirePacket{}, err
	}
	return candidate.HirePacket{Status: status, Checklist: checklist, GeneratedAt: now.UTC()}, nil
}

// patchHirePacketItem sets one checklist row to todo, done, or skipped.
func patchHirePacketItem(current *candidate.OfferRecord, itemID string, input HirePacketItemInput) (*candidate.OfferRecord, candidate.HirePacket, error) {
	status := strings.TrimSpace(input.Status)
	if status != candidate.HireItemTodo && status != candidate.HireItemDone && status != candidate.HireItemSkipped {
		return nil, candidate.HirePacket{}, offerInput("Checklist item status must be todo, done, or skipped.")
	}
	if current == nil || current.HirePacket == nil || current.HirePacket.Status == "" || current.HirePacket.Status == candidate.HirePacketNone {
		return nil, candidate.HirePacket{}, offerInput("Generate a hire packet before updating the checklist.")
	}
	itemID = strings.TrimSpace(itemID)
	if itemID == "" {
		return nil, candidate.HirePacket{}, ErrNotFound
	}
	next := cloneOffer(current)
	packet := *next.HirePacket
	packet.Checklist = append([]candidate.HirePacketItem(nil), next.HirePacket.Checklist...)
	found := false
	for i := range packet.Checklist {
		if packet.Checklist[i].ID == itemID {
			packet.Checklist[i].Status = status
			found = true
			break
		}
	}
	if !found {
		return nil, candidate.HirePacket{}, ErrNotFound
	}
	if packet.Checklist == nil {
		packet.Checklist = []candidate.HirePacketItem{}
	}
	next.HirePacket = &packet
	return next, packet, nil
}

func defaultHireChecklist() ([]candidate.HirePacketItem, error) {
	out := make([]candidate.HirePacketItem, 0, len(defaultHireLabels))
	for _, label := range defaultHireLabels {
		id, err := prefixedID("hire")
		if err != nil {
			return nil, err
		}
		out = append(out, candidate.HirePacketItem{ID: id, Label: label, Status: candidate.HireItemTodo})
	}
	return out, nil
}

func normalizeApproverIDs(values []string) []string {
	out := make([]string, 0, min(len(values), maxApprovers))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = clip(value, maxApproverID)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
		if len(out) == maxApprovers {
			break
		}
	}
	return out
}

func normalizeComp(raw *candidate.CompPackage) (*candidate.CompPackage, error) {
	if raw == nil {
		return nil, nil
	}
	comp := &candidate.CompPackage{Currency: defaultOfferCurrency}
	if currency := strings.ToUpper(clip(raw.Currency, maxCurrencyLen)); currency != "" {
		comp.Currency = currency
	}
	var err error
	if comp.BaseSalaryCents, err = nonNegativeCents(raw.BaseSalaryCents); err != nil {
		return nil, err
	}
	if comp.BonusCents, err = nonNegativeCents(raw.BonusCents); err != nil {
		return nil, err
	}
	if comp.SigningBonusCents, err = nonNegativeCents(raw.SigningBonusCents); err != nil {
		return nil, err
	}
	if start := strings.TrimSpace(raw.StartDate); start != "" {
		if !ymdPattern.MatchString(start) {
			return nil, offerInput("Start date must be YYYY-MM-DD.")
		}
		comp.StartDate = start
	}
	comp.EquityNote = clip(raw.EquityNote, maxEquityNote)
	comp.Notes = clip(raw.Notes, maxCompNotes)
	return comp, nil
}

func nonNegativeCents(value *int) (*int, error) {
	if value == nil {
		return nil, nil
	}
	if *value < 0 {
		return nil, offerInput("Compensation amounts must be zero or more.")
	}
	next := *value
	return &next, nil
}

// assignOfferTemplates keeps stored templates when the PUT body omits the field.
// A present array, including an empty one, replaces them.
func assignOfferTemplates(input, existing []candidate.OfferTemplate) ([]candidate.OfferTemplate, error) {
	if input == nil {
		return existing, nil
	}
	return normalizeOfferTemplates(input)
}

func normalizeOfferTemplates(items []candidate.OfferTemplate) ([]candidate.OfferTemplate, error) {
	if items == nil {
		return nil, nil
	}
	out := make([]candidate.OfferTemplate, 0, min(len(items), maxOfferTemplates))
	seen := map[string]struct{}{}
	for _, item := range items {
		name := clip(item.Name, maxOfferTemplateName)
		if name == "" {
			continue
		}
		id := clip(item.ID, maxTemplateID)
		if id == "" {
			var err error
			id, err = prefixedID("otmpl")
			if err != nil {
				return nil, err
			}
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		next := candidate.OfferTemplate{
			ID:               id,
			Name:             name,
			Body:             clipRunes(item.Body, maxOfferTemplateBody),
			RequiresApproval: item.RequiresApproval,
			RequiresEsign:    item.RequiresEsign,
		}
		if item.DefaultComp != nil {
			comp, err := normalizeComp(item.DefaultComp)
			if err != nil {
				return nil, err
			}
			next.DefaultComp = comp
		}
		out = append(out, next)
		if len(out) == maxOfferTemplates {
			break
		}
	}
	return out, nil
}

func clipRunes(value string, limit int) string {
	if len([]rune(value)) <= limit {
		return value
	}
	return string([]rune(value)[:limit])
}

func presentOffer(in *candidate.OfferRecord) *candidate.OfferRecord {
	if in == nil || in.Status == "" {
		return nil
	}
	out := cloneOffer(in)
	if out.HirePacket != nil && out.HirePacket.Checklist == nil {
		out.HirePacket.Checklist = []candidate.HirePacketItem{}
	}
	return out
}

func cloneOffer(in *candidate.OfferRecord) *candidate.OfferRecord {
	if in == nil {
		return nil
	}
	out := *in
	out.SentAt = cloneTime(in.SentAt)
	out.RespondedAt = cloneTime(in.RespondedAt)
	if in.Comp != nil {
		comp := *in.Comp
		comp.BaseSalaryCents = cloneInt(in.Comp.BaseSalaryCents)
		comp.BonusCents = cloneInt(in.Comp.BonusCents)
		comp.SigningBonusCents = cloneInt(in.Comp.SigningBonusCents)
		out.Comp = &comp
	}
	if in.Approval != nil {
		approval := *in.Approval
		approval.ApproverIDs = append([]string(nil), in.Approval.ApproverIDs...)
		out.Approval = &approval
	}
	if in.Esign != nil {
		esign := *in.Esign
		esign.SentAt = cloneTime(in.Esign.SentAt)
		esign.SignedAt = cloneTime(in.Esign.SignedAt)
		out.Esign = &esign
	}
	if in.HirePacket != nil {
		packet := *in.HirePacket
		packet.Checklist = append([]candidate.HirePacketItem(nil), in.HirePacket.Checklist...)
		out.HirePacket = &packet
	}
	return &out
}

func cloneTime(in *time.Time) *time.Time {
	if in == nil {
		return nil
	}
	when := in.UTC()
	return &when
}

func cloneInt(in *int) *int {
	if in == nil {
		return nil
	}
	value := *in
	return &value
}
