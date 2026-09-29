package staff

import (
	"errors"
	"testing"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
)

func TestNextCompanyTrust(t *testing.T) {
	tests := []struct {
		name      string
		trust     string
		claim     string
		decision  string
		wantTrust string
		wantClaim string
		wantErr   error
	}{
		{"approve claimed", jobs.TrustClaimed, jobs.ClaimPending, DecisionApprove, jobs.TrustVerified, jobs.ClaimApproved, nil},
		{"approve unclaimed", jobs.TrustUnclaimed, "", DecisionApprove, jobs.TrustVerified, jobs.ClaimApproved, nil},
		{"approve suspended", jobs.TrustSuspended, jobs.ClaimApproved, DecisionApprove, jobs.TrustVerified, jobs.ClaimApproved, nil},
		{"approve again", jobs.TrustVerified, jobs.ClaimApproved, DecisionApprove, jobs.TrustVerified, jobs.ClaimApproved, ErrNoChange},
		{"reject claim", jobs.TrustClaimed, jobs.ClaimPending, DecisionReject, jobs.TrustUnclaimed, jobs.ClaimRejected, nil},
		{"reject verified", jobs.TrustVerified, jobs.ClaimApproved, DecisionReject, "", "", ErrConflict},
		{"reject twice", jobs.TrustUnclaimed, jobs.ClaimRejected, DecisionReject, "", "", ErrConflict},
		{"suspend verified", jobs.TrustVerified, jobs.ClaimApproved, DecisionSuspend, jobs.TrustSuspended, jobs.ClaimApproved, nil},
		{"suspend again", jobs.TrustSuspended, jobs.ClaimApproved, DecisionSuspend, jobs.TrustSuspended, jobs.ClaimApproved, ErrNoChange},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gotTrust, gotClaim, err := NextCompanyTrust(test.trust, test.claim, test.decision)
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("err = %v, want %v", err, test.wantErr)
			}
			if err != nil {
				return
			}
			if gotTrust != test.wantTrust || gotClaim != test.wantClaim {
				t.Fatalf("got %s/%s, want %s/%s", gotTrust, gotClaim, test.wantTrust, test.wantClaim)
			}
		})
	}
}

func TestReviewListing(t *testing.T) {
	pending := ListingState{Status: jobs.ListingPendingReview}
	active, err := ReviewListing(pending, DecisionApprove, "")
	if err != nil || active.Status != jobs.ListingActive || active.Cause != "" {
		t.Fatalf("approve = %+v %v", active, err)
	}
	removed, err := ReviewListing(pending, DecisionReject, jobs.ListingRemoved)
	if err != nil || removed.Status != jobs.ListingRemoved || removed.Cause != jobs.TakedownStaff || removed.Previous != jobs.ListingPendingReview {
		t.Fatalf("reject removed = %+v %v", removed, err)
	}
	draft, err := ReviewListing(pending, DecisionReject, jobs.ListingDraft)
	if err != nil || draft.Status != jobs.ListingDraft || draft.Cause != "" {
		t.Fatalf("reject draft = %+v %v", draft, err)
	}
	if _, err := ReviewListing(pending, DecisionReject, jobs.ListingActive); err == nil {
		t.Fatal("reject to active should fail")
	}
	if _, err := ReviewListing(ListingState{Status: jobs.ListingActive}, DecisionApprove, ""); !errors.Is(err, ErrConflict) {
		t.Fatalf("approve active err = %v", err)
	}
}

func TestTakedownAndRestore(t *testing.T) {
	down, err := TakedownListing(ListingState{Status: jobs.ListingActive})
	if err != nil || down.Status != jobs.ListingRemoved || down.Previous != jobs.ListingActive || down.Cause != jobs.TakedownStaff {
		t.Fatalf("takedown = %+v %v", down, err)
	}
	legacy, err := TakedownListing(ListingState{})
	if err != nil || legacy.Previous != jobs.ListingActive {
		t.Fatalf("legacy takedown = %+v %v", legacy, err)
	}
	back, err := RestoreListing(down)
	if err != nil || back.Status != jobs.ListingActive || back.Cause != "" {
		t.Fatalf("restore = %+v %v", back, err)
	}
	if _, err := TakedownListing(ListingState{Status: jobs.ListingPendingReview}); !errors.Is(err, ErrConflict) {
		t.Fatalf("takedown pending err = %v", err)
	}
	if _, err := RestoreListing(ListingState{Status: jobs.ListingActive}); !errors.Is(err, ErrConflict) {
		t.Fatalf("restore active err = %v", err)
	}
}

func TestCompanyDecisionRequiresReason(t *testing.T) {
	input := CompanyDecision{Decision: DecisionReject}
	if err := input.Normalize(); err == nil {
		t.Fatal("reject without a reason should fail")
	}
	input = CompanyDecision{Decision: DecisionApprove, ClaimMethod: "fax"}
	if err := input.Normalize(); err == nil {
		t.Fatal("unknown claim method should fail")
	}
	input = CompanyDecision{Decision: DecisionSuspend, Reason: "scam reports", ClaimMethod: jobs.ClaimDomainEmail}
	if err := input.Normalize(); err != nil {
		t.Fatal(err)
	}
}
