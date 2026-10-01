package candidate

import "time"

// Offer and hire shapes match joined-frontend/lib/offer-hire.ts.
// Field names are the API contract.

const (
	OfferDraft            = "draft"
	OfferPendingApproval  = "pending_approval"
	OfferApproved         = "approved"
	OfferSent             = "sent"
	OfferAccepted         = "accepted"
	OfferDeclined         = "declined"
	OfferExpired          = "expired"
	OfferWithdrawn        = "withdrawn"
	OfferApprovalPending  = "pending"
	OfferApprovalApproved = "approved"
	OfferApprovalRejected = "rejected"
	OfferEsignNone        = "none"
	OfferEsignPending     = "pending"
	OfferEsignSigned      = "signed"
	OfferEsignDeclined    = "declined"
	HirePacketNone        = "none"
	HirePacketDraft       = "draft"
	HirePacketReady       = "ready"
	HirePacketSent        = "sent"
	HireItemTodo          = "todo"
	HireItemDone          = "done"
	HireItemSkipped       = "skipped"
)

// CompPackage is annual compensation. Amounts are integer cents.
type CompPackage struct {
	BaseSalaryCents   *int   `json:"baseSalaryCents,omitempty" bson:"baseSalaryCents,omitempty"`
	Currency          string `json:"currency,omitempty" bson:"currency,omitempty"`
	EquityNote        string `json:"equityNote,omitempty" bson:"equityNote,omitempty"`
	BonusCents        *int   `json:"bonusCents,omitempty" bson:"bonusCents,omitempty"`
	SigningBonusCents *int   `json:"signingBonusCents,omitempty" bson:"signingBonusCents,omitempty"`
	StartDate         string `json:"startDate,omitempty" bson:"startDate,omitempty"`
	Notes             string `json:"notes,omitempty" bson:"notes,omitempty"`
}

// OfferTemplate is a reusable letter stored on the company job.
type OfferTemplate struct {
	ID               string       `json:"id" bson:"id"`
	Name             string       `json:"name" bson:"name"`
	Body             string       `json:"body" bson:"body"`
	DefaultComp      *CompPackage `json:"defaultComp,omitempty" bson:"defaultComp,omitempty"`
	RequiresApproval bool         `json:"requiresApproval" bson:"requiresApproval"`
	RequiresEsign    bool         `json:"requiresEsign" bson:"requiresEsign"`
}

// OfferApproval is one light internal approval on the offer.
type OfferApproval struct {
	ID          string    `json:"id" bson:"id"`
	Status      string    `json:"status" bson:"status"`
	RequestedAt time.Time `json:"requestedAt" bson:"requestedAt"`
	DecidedAt   time.Time `json:"decidedAt,omitempty" bson:"decidedAt,omitempty"`
	ApproverIDs []string  `json:"approverIds,omitempty" bson:"approverIds,omitempty"`
	DecidedBy   string    `json:"decidedBy,omitempty" bson:"decidedBy,omitempty"`
	Note        string    `json:"note,omitempty" bson:"note,omitempty"`
}

// OfferEsign is a first-party Joined sign link. No external e-sign vendor.
type OfferEsign struct {
	Status        string     `json:"status" bson:"status"`
	DocumentTitle string     `json:"documentTitle,omitempty" bson:"documentTitle,omitempty"`
	SignURL       string     `json:"signUrl,omitempty" bson:"signUrl,omitempty"`
	SentAt        *time.Time `json:"sentAt,omitempty" bson:"sentAt,omitempty"`
	SignedAt      *time.Time `json:"signedAt,omitempty" bson:"signedAt,omitempty"`
}

// HirePacketItem is one onboarding checklist row.
type HirePacketItem struct {
	ID     string `json:"id" bson:"id"`
	Label  string `json:"label" bson:"label"`
	Status string `json:"status" bson:"status"`
}

// HirePacket is a light handoff checklist, not an HRIS record.
type HirePacket struct {
	Status        string           `json:"status" bson:"status"`
	Checklist     []HirePacketItem `json:"checklist" bson:"checklist"`
	StartDate     string           `json:"startDate,omitempty" bson:"startDate,omitempty"`
	OwnerNote     string           `json:"ownerNote,omitempty" bson:"ownerNote,omitempty"`
	HandoffTarget string           `json:"handoffTarget,omitempty" bson:"handoffTarget,omitempty"`
	GeneratedAt   time.Time        `json:"generatedAt,omitempty" bson:"generatedAt,omitempty"`
}

// OfferRecord is Applicant.offer.
type OfferRecord struct {
	Status      string         `json:"status" bson:"status"`
	TemplateID  string         `json:"templateId,omitempty" bson:"templateId,omitempty"`
	SentAt      *time.Time     `json:"sentAt,omitempty" bson:"sentAt,omitempty"`
	RespondedAt *time.Time     `json:"respondedAt,omitempty" bson:"respondedAt,omitempty"`
	ExpiresAt   string         `json:"expiresAt,omitempty" bson:"expiresAt,omitempty"`
	Notes       string         `json:"notes,omitempty" bson:"notes,omitempty"`
	Comp        *CompPackage   `json:"comp,omitempty" bson:"comp,omitempty"`
	Approval    *OfferApproval `json:"approval,omitempty" bson:"approval,omitempty"`
	Esign       *OfferEsign    `json:"esign,omitempty" bson:"esign,omitempty"`
	HirePacket  *HirePacket    `json:"hirePacket,omitempty" bson:"hirePacket,omitempty"`
}
