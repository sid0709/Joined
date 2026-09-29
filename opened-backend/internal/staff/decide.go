package staff

import (
	"strings"
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
)

const (
	DecisionApprove = "approve"
	DecisionReject  = "reject"
	DecisionSuspend = "suspend"

	maxNote = 1000
)

// CompanyDecision is a staff call on a company claim or verification.
type CompanyDecision struct {
	Decision    string `json:"decision"`
	Reason      string `json:"reason"`
	ClaimMethod string `json:"claim_method"`
}

// Normalize checks the decision body and trims it.
func (d *CompanyDecision) Normalize() error {
	d.Decision = strings.TrimSpace(d.Decision)
	d.Reason = strings.TrimSpace(d.Reason)
	d.ClaimMethod = strings.TrimSpace(d.ClaimMethod)
	var fields []FieldError
	switch d.Decision {
	case DecisionApprove, DecisionReject, DecisionSuspend:
	default:
		fields = append(fields, FieldError{Field: "decision", Detail: "use approve, reject, or suspend"})
	}
	if reasonRequired(d.Decision) && d.Reason == "" {
		fields = append(fields, FieldError{Field: "reason", Detail: "a reason is required"})
	}
	if utf8.RuneCountInString(d.Reason) > maxNote {
		fields = append(fields, FieldError{Field: "reason", Detail: "reason is too long"})
	}
	if d.ClaimMethod != "" && !validClaimMethod(d.ClaimMethod) {
		fields = append(fields, FieldError{Field: "claim_method", Detail: "use domain_email, dns_txt, or manual"})
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

// NextCompanyTrust is the company trust and claim status after a decision.
// ErrNoChange means the company is already there. ErrConflict means the decision is not allowed.
func NextCompanyTrust(trust, claimStatus, decision string) (string, string, error) {
	trust = jobs.EffectiveTrust(trust)
	switch decision {
	case DecisionApprove:
		if trust == jobs.TrustVerified {
			return jobs.TrustVerified, jobs.ClaimApproved, ErrNoChange
		}
		return jobs.TrustVerified, jobs.ClaimApproved, nil
	case DecisionReject:
		if trust == jobs.TrustVerified || trust == jobs.TrustSuspended {
			return "", "", ErrConflict
		}
		if trust == jobs.TrustUnclaimed && claimStatus == jobs.ClaimRejected {
			return "", "", ErrConflict
		}
		return jobs.TrustUnclaimed, jobs.ClaimRejected, nil
	case DecisionSuspend:
		if trust == jobs.TrustSuspended {
			if claimStatus == "" {
				claimStatus = jobs.ClaimPending
			}
			return jobs.TrustSuspended, claimStatus, ErrNoChange
		}
		if claimStatus == "" {
			claimStatus = jobs.ClaimPending
		}
		return jobs.TrustSuspended, claimStatus, nil
	default:
		return "", "", ErrConflict
	}
}

// ListingState is the public status of one direct job.
type ListingState struct {
	Status   string
	Previous string
	Cause    string
}

// JobReview is a staff call on a direct job in pending_review.
type JobReview struct {
	Decision string `json:"decision"`
	Status   string `json:"status"`
	Reason   string `json:"reason"`
}

// Normalize checks an approve or reject body.
func (d *JobReview) Normalize() error {
	d.Decision = strings.TrimSpace(d.Decision)
	d.Status = strings.TrimSpace(d.Status)
	d.Reason = strings.TrimSpace(d.Reason)
	var fields []FieldError
	switch d.Decision {
	case DecisionApprove, DecisionReject:
	default:
		fields = append(fields, FieldError{Field: "decision", Detail: "use approve or reject"})
	}
	if d.Decision == DecisionReject && d.Reason == "" {
		fields = append(fields, FieldError{Field: "reason", Detail: "a reason is required"})
	}
	if utf8.RuneCountInString(d.Reason) > maxNote {
		fields = append(fields, FieldError{Field: "reason", Detail: "reason is too long"})
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

// ReviewListing applies approve (pending_review → active) or reject (→ removed or draft).
func ReviewListing(state ListingState, decision, rejectStatus string) (ListingState, error) {
	switch decision {
	case DecisionApprove:
		if state.Status != jobs.ListingPendingReview {
			return ListingState{}, ErrConflict
		}
		return ListingState{Status: jobs.ListingActive}, nil
	case DecisionReject:
		if state.Status != jobs.ListingPendingReview {
			return ListingState{}, ErrConflict
		}
		if rejectStatus != jobs.ListingRemoved && rejectStatus != jobs.ListingDraft {
			return ListingState{}, &ValidationError{Fields: []FieldError{{Field: "status", Detail: "use removed or draft"}}}
		}
		next := ListingState{Status: rejectStatus, Previous: jobs.ListingPendingReview}
		if rejectStatus == jobs.ListingRemoved {
			next.Cause = jobs.TakedownStaff
		}
		return next, nil
	default:
		return ListingState{}, ErrConflict
	}
}

// TakedownListing hides a live direct job. RestoreListing puts it back.
func TakedownListing(state ListingState) (ListingState, error) {
	if !jobs.ListingPublic(state.Status) {
		return ListingState{}, ErrConflict
	}
	prev := state.Status
	if prev == "" {
		prev = jobs.ListingActive
	}
	return ListingState{Status: jobs.ListingRemoved, Previous: prev, Cause: jobs.TakedownStaff}, nil
}

// RestoreListing undoes a takedown or a reject-to-removed.
func RestoreListing(state ListingState) (ListingState, error) {
	if state.Status != jobs.ListingRemoved {
		return ListingState{}, ErrConflict
	}
	next := state.Previous
	switch next {
	case jobs.ListingActive, jobs.ListingPendingReview, jobs.ListingDraft:
	default:
		next = jobs.ListingActive
	}
	return ListingState{Status: next}, nil
}

// Note is a reason on takedown or restore.
type Note struct {
	Reason string `json:"reason"`
}

// NormalizeReason requires a reason, for takedown.
func NormalizeReason(reason string, required bool) (string, error) {
	reason = strings.TrimSpace(reason)
	var fields []FieldError
	if required && reason == "" {
		fields = append(fields, FieldError{Field: "reason", Detail: "a reason is required"})
	}
	if utf8.RuneCountInString(reason) > maxNote {
		fields = append(fields, FieldError{Field: "reason", Detail: "reason is too long"})
	}
	if len(fields) > 0 {
		return "", &ValidationError{Fields: fields}
	}
	return reason, nil
}

func reasonRequired(decision string) bool {
	return decision == DecisionReject || decision == DecisionSuspend
}

func validClaimMethod(method string) bool {
	switch method {
	case jobs.ClaimDomainEmail, jobs.ClaimDNSTXT, jobs.ClaimManual:
		return true
	default:
		return false
	}
}
