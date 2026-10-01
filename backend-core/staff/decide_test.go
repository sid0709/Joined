package staff

import (
	"errors"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

func TestNextVerification(t *testing.T) {
	cases := []struct {
		name     string
		status   string
		decision string
		want     string
		err      error
	}{
		{"approve pending", jobs.VerificationPending, DecisionApprove, jobs.VerificationApproved, nil},
		{"approve unclaimed", jobs.VerificationUnclaimed, DecisionApprove, jobs.VerificationApproved, nil},
		{"approve empty", "", DecisionApprove, jobs.VerificationApproved, nil},
		{"approve rejected", jobs.VerificationRejected, DecisionApprove, jobs.VerificationApproved, nil},
		{"approve suspended", jobs.VerificationSuspended, DecisionApprove, jobs.VerificationApproved, nil},
		{"approve again", jobs.VerificationApproved, DecisionApprove, "", ErrConflict},
		{"reject pending", jobs.VerificationPending, DecisionReject, jobs.VerificationRejected, nil},
		{"reject unclaimed", jobs.VerificationUnclaimed, DecisionReject, jobs.VerificationRejected, nil},
		{"reject approved", jobs.VerificationApproved, DecisionReject, "", ErrConflict},
		{"reject suspended", jobs.VerificationSuspended, DecisionReject, "", ErrConflict},
		{"reject again", jobs.VerificationRejected, DecisionReject, "", ErrConflict},
		{"suspend approved", jobs.VerificationApproved, DecisionSuspend, jobs.VerificationSuspended, nil},
		{"suspend pending", jobs.VerificationPending, DecisionSuspend, jobs.VerificationSuspended, nil},
		{"suspend again", jobs.VerificationSuspended, DecisionSuspend, "", ErrConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := NextVerification(tc.status, tc.decision)
			if !errors.Is(err, tc.err) || got != tc.want {
				t.Fatalf("NextVerification(%q, %q) = %q, %v", tc.status, tc.decision, got, err)
			}
		})
	}
}

func TestVerifyRequiresReason(t *testing.T) {
	err := (&CompanyVerify{Decision: DecisionApprove}).Normalize()
	var fields *ValidationError
	if !errors.As(err, &fields) {
		t.Fatalf("err = %v", err)
	}
	if len(fields.Fields) != 1 || fields.Fields[0].Field != "reason" {
		t.Fatalf("fields = %+v", fields.Fields)
	}
	if err := (&CompanyVerify{Decision: DecisionReject, Reason: "domain does not match"}).Normalize(); err != nil {
		t.Fatal(err)
	}
}

func TestReviewJob(t *testing.T) {
	got, err := ReviewJob(jobs.JobPendingReview, DecisionApprove, "")
	if err != nil || got != jobs.JobOpen {
		t.Fatalf("approve pending = %q, %v", got, err)
	}
	got, err = ReviewJob(jobs.JobRemoved, DecisionApprove, "")
	if err != nil || got != jobs.JobOpen {
		t.Fatalf("approve removed = %q, %v", got, err)
	}
	if _, err := ReviewJob(jobs.JobOpen, DecisionApprove, ""); !errors.Is(err, ErrConflict) {
		t.Fatalf("approve open = %v", err)
	}
	got, err = ReviewJob(jobs.JobPendingReview, DecisionReject, "")
	if err != nil || got != jobs.JobRemoved {
		t.Fatalf("reject default = %q, %v", got, err)
	}
	got, err = ReviewJob(jobs.JobPendingReview, DecisionReject, jobs.JobDraft)
	if err != nil || got != jobs.JobDraft {
		t.Fatalf("reject draft = %q, %v", got, err)
	}
	if _, err := ReviewJob(jobs.JobOpen, DecisionReject, jobs.JobRemoved); !errors.Is(err, ErrConflict) {
		t.Fatalf("reject open = %v", err)
	}
	if _, err := ReviewJob(jobs.JobRemoved, DecisionReject, jobs.JobDraft); !errors.Is(err, ErrConflict) {
		t.Fatalf("reject removed = %v", err)
	}
}

func TestReviewReasonOptional(t *testing.T) {
	input := JobReview{Decision: DecisionReject}
	if err := input.Normalize(); err != nil {
		t.Fatal(err)
	}
	input = JobReview{Decision: DecisionReject, RejectDisposition: "archive"}
	err := input.Normalize()
	var fields *ValidationError
	if !errors.As(err, &fields) || fields.Fields[0].Field != "rejectDisposition" {
		t.Fatalf("err = %v", err)
	}
}

func TestTakedownJob(t *testing.T) {
	for _, status := range []string{jobs.JobOpen, jobs.JobPendingReview} {
		got, err := TakedownJob(status)
		if err != nil || got != jobs.JobRemoved {
			t.Fatalf("takedown %s = %q, %v", status, got, err)
		}
	}
	for _, status := range []string{jobs.JobRemoved, jobs.JobDraft, jobs.JobClosed, jobs.JobPaused} {
		if _, err := TakedownJob(status); !errors.Is(err, ErrConflict) {
			t.Fatalf("takedown %s = %v", status, err)
		}
	}
	if _, err := NormalizeReason("  ", true); err == nil {
		t.Fatal("takedown reason is required")
	}
	reason, err := NormalizeReason("  policy  ", true)
	if err != nil || reason != "policy" {
		t.Fatalf("reason = %q, %v", reason, err)
	}
	if _, err := NormalizeReason(strings.Repeat("x", maxNote+1), true); err == nil {
		t.Fatal("reason length")
	}
}
