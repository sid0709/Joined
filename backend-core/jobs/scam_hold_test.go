package jobs

import (
	"context"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobscam"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type fakeScamAPI struct {
	decision jobscam.Decision
	err      error
	got      jobscam.Input
}

func (f *fakeScamAPI) Inspect(_ context.Context, in jobscam.Input, _ time.Time) (jobscam.Decision, error) {
	f.got = in
	return f.decision, f.err
}

func (f *fakeScamAPI) List(context.Context, jobscam.ListQuery) (jobscam.List, error) {
	return jobscam.List{}, nil
}

func (f *fakeScamAPI) Review(context.Context, string, string, jobscam.Review, time.Time) (jobscam.Hold, error) {
	return jobscam.Hold{}, nil
}

func TestApplyScamHoldSetsPendingReview(t *testing.T) {
	fake := &fakeScamAPI{decision: jobscam.Decision{Result: jobscam.Result{Hold: true, Score: 40}}}
	store := &Store{scamHolds: fake}
	doc := storedSearchJob{
		ID:        bson.NewObjectID(),
		ApplyLink: "https://example.com/jobs/1",
		Job: SearchJob{
			ID:          "job-1",
			Title:       "Clerk",
			Company:     "Acme",
			Description: "Pay to apply",
		},
	}
	got, err := store.applyScamHold(context.Background(), doc)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if got.ListingStatus != ListingPendingReview {
		t.Fatalf("listingStatus = %q", got.ListingStatus)
	}
	if fake.got.JobID != "job-1" || fake.got.ApplyURL != doc.ApplyLink {
		t.Fatalf("input = %+v", fake.got)
	}
}

func TestApplyScamHoldKeepsRejectedRemoved(t *testing.T) {
	fake := &fakeScamAPI{decision: jobscam.Decision{Result: jobscam.Result{Hold: true}, Remove: true}}
	store := &Store{scamHolds: fake}
	doc := storedSearchJob{Job: SearchJob{ID: "job-1", Title: "Clerk", Description: "fee"}}
	got, err := store.applyScamHold(context.Background(), doc)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if got.ListingStatus != ListingRemoved {
		t.Fatalf("listingStatus = %q", got.ListingStatus)
	}
}

func TestApplyScamHoldNilGateLeavesPublic(t *testing.T) {
	doc := storedSearchJob{Job: SearchJob{ID: "job-1", Title: "Engineer", Description: "Build APIs"}}
	got, err := (*Store)(nil).applyScamHold(context.Background(), doc)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if got.ListingStatus != "" {
		t.Fatalf("listingStatus = %q", got.ListingStatus)
	}
}

func TestApplyScamHoldDoesNotUnhideNonPublic(t *testing.T) {
	fake := &fakeScamAPI{decision: jobscam.Decision{Result: jobscam.Result{Hold: true}}}
	store := &Store{scamHolds: fake}
	doc := storedSearchJob{ListingStatus: ListingExpired, Job: SearchJob{ID: "job-1", Description: "fee"}}
	got, err := store.applyScamHold(context.Background(), doc)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if got.ListingStatus != ListingExpired {
		t.Fatalf("expired listing should stay expired, got %q", got.ListingStatus)
	}
}
