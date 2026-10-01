package staff

import (
	"strings"
	"unicode/utf8"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const (
	DecisionApprove = "approve"
	DecisionReject  = "reject"
	DecisionSuspend = "suspend"
)

// CompanyVerify is POST /v1/admin/companies/{id}/verify.
type CompanyVerify struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason"`
}

// Normalize checks the decision and requires a reason for every decision.
func (d *CompanyVerify) Normalize() error {
	d.Decision = strings.TrimSpace(d.Decision)
	d.Reason = strings.TrimSpace(d.Reason)
	var fields []FieldError
	switch d.Decision {
	case DecisionApprove, DecisionReject, DecisionSuspend:
	default:
		fields = append(fields, FieldError{Field: "decision", Detail: "use approve, reject, or suspend"})
	}
	if d.Reason == "" {
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

// NextVerification is the company verificationStatus after a decision.
// ErrConflict means the decision does not change the company.
func NextVerification(status, decision string) (string, error) {
	status = jobs.EffectiveVerification(status)
	switch decision {
	case DecisionApprove:
		if status == jobs.VerificationApproved {
			return "", ErrConflict
		}
		return jobs.VerificationApproved, nil
	case DecisionReject:
		switch status {
		case jobs.VerificationApproved, jobs.VerificationSuspended, jobs.VerificationRejected:
			return "", ErrConflict
		default:
			return jobs.VerificationRejected, nil
		}
	case DecisionSuspend:
		if status == jobs.VerificationSuspended {
			return "", ErrConflict
		}
		return jobs.VerificationSuspended, nil
	default:
		return "", ErrConflict
	}
}

// JobReview is POST /v1/admin/jobs/{id}/review.
type JobReview struct {
	Decision          string `json:"decision"`
	Reason            string `json:"reason,omitempty"`
	RejectDisposition string `json:"rejectDisposition,omitempty"`
}

// Normalize checks approve or reject. Reason is optional.
// rejectDisposition must be removed or draft when it is set.
func (d *JobReview) Normalize() error {
	d.Decision = strings.TrimSpace(d.Decision)
	d.Reason = strings.TrimSpace(d.Reason)
	d.RejectDisposition = strings.TrimSpace(d.RejectDisposition)
	var fields []FieldError
	switch d.Decision {
	case DecisionApprove, DecisionReject:
	default:
		fields = append(fields, FieldError{Field: "decision", Detail: "use approve or reject"})
	}
	if d.RejectDisposition != "" && d.RejectDisposition != jobs.JobRemoved && d.RejectDisposition != jobs.JobDraft {
		fields = append(fields, FieldError{Field: "rejectDisposition", Detail: "use removed or draft"})
	}
	if utf8.RuneCountInString(d.Reason) > maxNote {
		fields = append(fields, FieldError{Field: "reason", Detail: "reason is too long"})
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

// ReviewJob applies approve (pending_review or removed → open) or reject (pending_review → removed or draft).
// An empty disposition rejects to removed.
func ReviewJob(status, decision, disposition string) (string, error) {
	switch decision {
	case DecisionApprove:
		if status != jobs.JobPendingReview && status != jobs.JobRemoved {
			return "", ErrConflict
		}
		return jobs.JobOpen, nil
	case DecisionReject:
		if status != jobs.JobPendingReview {
			return "", ErrConflict
		}
		if disposition == "" {
			disposition = jobs.JobRemoved
		}
		if disposition != jobs.JobRemoved && disposition != jobs.JobDraft {
			return "", &ValidationError{Fields: []FieldError{{Field: "rejectDisposition", Detail: "use removed or draft"}}}
		}
		return disposition, nil
	default:
		return "", ErrConflict
	}
}

// TakedownJob hides an open or pending_review direct job. Approve puts a removed job back.
func TakedownJob(status string) (string, error) {
	switch status {
	case jobs.JobOpen, jobs.JobPendingReview:
		return jobs.JobRemoved, nil
	default:
		return "", ErrConflict
	}
}

// Takedown is POST /v1/admin/jobs/{id}/takedown.
type Takedown struct {
	Reason string `json:"reason"`
}

// NormalizeReason trims a reason and optionally requires it.
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
