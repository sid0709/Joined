package jobscam

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestInspectHoldsPayToApply(t *testing.T) {
	mem := NewMemory()
	svc := NewService(mem, mem, Config{HoldThreshold: DefaultHoldThreshold})
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	decision, err := svc.Inspect(context.Background(), Input{
		JobID:       "job-1",
		Title:       "Clerk",
		Company:     "Quick Hire",
		Description: "Pay to apply with a $40 registration fee.",
		ApplyURL:    "https://quick.example/jobs/1",
		CompanyURL:  "https://quick.example",
	}, now)
	if err != nil {
		t.Fatalf("inspect: %v", err)
	}
	if !decision.Hold || decision.Remove {
		t.Fatalf("decision = %+v", decision)
	}
	hold, err := mem.Get(context.Background(), "job-1")
	if err != nil || hold.Status != StatusHeld || hold.Score < DefaultHoldThreshold {
		t.Fatalf("hold = %+v err = %v", hold, err)
	}
}

func TestInspectCleanJobIsNotStored(t *testing.T) {
	mem := NewMemory()
	svc := NewService(mem, mem, Config{HoldThreshold: DefaultHoldThreshold})
	decision, err := svc.Inspect(context.Background(), Input{
		JobID:       "job-clean",
		Title:       "Staff engineer",
		Company:     "Acme",
		Description: "Build the job search API.",
		ApplyURL:    "https://boards.greenhouse.io/acme/jobs/99",
	}, time.Time{})
	if err != nil {
		t.Fatalf("inspect: %v", err)
	}
	if decision.Hold {
		t.Fatalf("clean job held: %+v", decision)
	}
	if _, err := mem.Get(context.Background(), "job-clean"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("clean job should not be queued: %v", err)
	}
}

func TestInspectFlagsDuplicateFingerprint(t *testing.T) {
	mem := NewMemory()
	svc := NewService(mem, mem, Config{HoldThreshold: DefaultHoldThreshold})
	in := Input{
		JobID:       "job-a",
		Title:       "Clerk",
		Company:     "Quick Hire",
		Description: "Pay to apply with a $40 registration fee.",
		ApplyURL:    "https://quick.example/jobs/1",
		CompanyURL:  "https://quick.example",
	}
	if _, err := svc.Inspect(context.Background(), in, time.Now()); err != nil {
		t.Fatalf("first: %v", err)
	}
	in.JobID = "job-b"
	decision, err := svc.Inspect(context.Background(), in, time.Now())
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	if !hasReason(decision.Result, ReasonDuplicateSpam) {
		t.Fatalf("duplicate copy should add duplicate_spam: %+v", decision.Reasons)
	}
}

func TestReviewApproveAndReject(t *testing.T) {
	mem := NewMemory()
	svc := NewService(mem, mem, Config{HoldThreshold: DefaultHoldThreshold})
	now := time.Date(2026, 10, 5, 15, 0, 0, 0, time.UTC)
	if _, err := svc.Inspect(context.Background(), Input{
		JobID:       "job-1",
		Title:       "Clerk",
		Company:     "Quick Hire",
		Description: "Pay to apply with a $40 registration fee.",
		ApplyURL:    "https://quick.example/jobs/1",
		CompanyURL:  "https://quick.example",
	}, now); err != nil {
		t.Fatalf("inspect: %v", err)
	}
	approved, err := svc.Review(context.Background(), "job-1", "roosebelt", Review{Decision: DecisionApprove, Reason: "known employer"}, now)
	if err != nil {
		t.Fatalf("approve: %v", err)
	}
	if approved.Status != StatusApproved || mem.ListingStatus("job-1") != ListingActive {
		t.Fatalf("approved = %+v listing = %q", approved, mem.ListingStatus("job-1"))
	}
	if _, err := svc.Review(context.Background(), "job-1", "roosebelt", Review{Decision: DecisionReject, Reason: "still a scam"}, now); !errors.Is(err, ErrConflict) {
		t.Fatalf("second review err = %v", err)
	}

	if _, err := svc.Inspect(context.Background(), Input{
		JobID:       "job-2",
		Title:       "Clerk",
		Company:     "Quick Hire",
		Description: "Training fee required before you start.",
		ApplyURL:    "https://quick.example/jobs/2",
		CompanyURL:  "https://quick.example",
	}, now); err != nil {
		t.Fatalf("inspect 2: %v", err)
	}
	rejected, err := svc.Review(context.Background(), "job-2", "roosebelt", Review{Decision: DecisionReject, Reason: "fee to apply"}, now)
	if err != nil {
		t.Fatalf("reject: %v", err)
	}
	if rejected.Status != StatusRejected || mem.ListingStatus("job-2") != ListingRemoved {
		t.Fatalf("rejected = %+v listing = %q", rejected, mem.ListingStatus("job-2"))
	}
	again, err := svc.Inspect(context.Background(), Input{
		JobID:       "job-2",
		Title:       "Clerk",
		Company:     "Quick Hire",
		Description: "Training fee required before you start.",
		ApplyURL:    "https://quick.example/jobs/2",
		CompanyURL:  "https://quick.example",
	}, now.Add(time.Hour))
	if err != nil {
		t.Fatalf("reinspect rejected: %v", err)
	}
	if !again.Remove || !again.Hold {
		t.Fatalf("rejected job must stay off the board: %+v", again)
	}
}

func TestApprovedSameFingerprintStaysPublic(t *testing.T) {
	mem := NewMemory()
	svc := NewService(mem, mem, Config{HoldThreshold: DefaultHoldThreshold})
	in := Input{
		JobID:       "job-1",
		Title:       "Clerk",
		Company:     "Quick Hire",
		Description: "Pay to apply with a $40 registration fee.",
		ApplyURL:    "https://quick.example/jobs/1",
		CompanyURL:  "https://quick.example",
	}
	if _, err := svc.Inspect(context.Background(), in, time.Now()); err != nil {
		t.Fatalf("inspect: %v", err)
	}
	if _, err := svc.Review(context.Background(), "job-1", "sid", Review{Decision: DecisionApprove, Reason: "false positive"}, time.Now()); err != nil {
		t.Fatalf("approve: %v", err)
	}
	decision, err := svc.Inspect(context.Background(), in, time.Now())
	if err != nil {
		t.Fatalf("reinspect: %v", err)
	}
	if decision.Hold {
		t.Fatalf("approved fingerprint should stay public: %+v", decision)
	}
}

func TestReviewRequiresReason(t *testing.T) {
	var input Review
	input.Decision = DecisionApprove
	err := input.Normalize()
	var fields *ValidationError
	if !errors.As(err, &fields) {
		t.Fatalf("err = %v", err)
	}
}

func TestListDefaultIsHeld(t *testing.T) {
	mem := NewMemory()
	svc := NewService(mem, mem, Config{HoldThreshold: DefaultHoldThreshold})
	now := time.Now().UTC()
	if _, err := svc.Inspect(context.Background(), Input{
		JobID: "job-1", Title: "Clerk", Company: "Quick Hire",
		Description: "Pay to apply with a $40 registration fee.",
		ApplyURL:    "https://quick.example/jobs/1", CompanyURL: "https://quick.example",
	}, now); err != nil {
		t.Fatalf("inspect: %v", err)
	}
	list, err := svc.List(context.Background(), ListQuery{})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if list.Total != 1 || len(list.Jobs) != 1 || list.Jobs[0].ID != "job-1" {
		t.Fatalf("list = %+v", list)
	}
	if _, err := svc.List(context.Background(), ListQuery{Status: "nope"}); err == nil {
		t.Fatal("invalid status should fail")
	}
}
