package jobscam

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

// API is the hold queue the admin HTTP server calls. Store is Mongo. Memory is tests.
type API interface {
	Inspect(ctx context.Context, in Input, now time.Time) (Decision, error)
	List(ctx context.Context, query ListQuery) (List, error)
	Review(ctx context.Context, id, actor string, input Review, now time.Time) (Hold, error)
}

// Listings updates a search row when staff approve or reject a hold.
type Listings interface {
	SetScamHoldStatus(ctx context.Context, jobID, status string) error
}

// Holds persists scored jobs that crossed the threshold.
type Holds interface {
	Get(ctx context.Context, id string) (Hold, error)
	Put(ctx context.Context, hold Hold) error
	List(ctx context.Context, query ListQuery) (List, error)
	CountFingerprint(ctx context.Context, fingerprint, exceptID string) (int, error)
}

var (
	_ API = (*Service)(nil)
)

// Service scores a job, holds it when the score is at or above the threshold,
// and lets staff publish or take it down.
type Service struct {
	cfg      Config
	holds    Holds
	listings Listings
}

func NewService(holds Holds, listings Listings, cfg Config) *Service {
	return &Service{cfg: cfg.withDefaults(), holds: holds, listings: listings}
}

// EnsureIndexes creates hold-queue indexes when the backing store is Mongo.
func (s *Service) EnsureIndexes(ctx context.Context) error {
	if s == nil {
		return nil
	}
	store, ok := s.holds.(*Store)
	if !ok || store == nil {
		return nil
	}
	return store.EnsureIndexes(ctx)
}

// Inspect scores the job, counts duplicate fingerprints, and records a hold when
// the job should not go public. An earlier reject stays removed. An earlier
// approve for the same fingerprint stays public.
func (s *Service) Inspect(ctx context.Context, in Input, now time.Time) (Decision, error) {
	if s == nil || s.holds == nil {
		return Decision{}, nil
	}
	cfg := s.cfg.withDefaults()
	if now.IsZero() {
		now = time.Now()
	}
	now = now.UTC()
	id := holdID(in)
	in.JobID = id
	fingerprint := Fingerprint(in.Title, in.Company, in.Description)
	hits, err := s.holds.CountFingerprint(ctx, fingerprint, id)
	if err != nil {
		return Decision{}, fmt.Errorf("count scam fingerprint: %w", err)
	}
	in.DuplicateHits = hits
	result := Score(in, cfg.HoldThreshold)

	existing, err := s.holds.Get(ctx, id)
	if err != nil && !isNotFound(err) {
		return Decision{}, fmt.Errorf("load scam hold: %w", err)
	}
	found := err == nil

	decision := Decision{Result: result}
	switch {
	case found && existing.Status == StatusRejected:
		decision.Hold = true
		decision.Remove = true
		existing = refreshHold(existing, in, result, now)
		existing.Status = StatusRejected
		if err := s.holds.Put(ctx, existing); err != nil {
			return Decision{}, fmt.Errorf("keep rejected scam hold: %w", err)
		}
		return decision, nil
	case found && existing.Status == StatusApproved && existing.Fingerprint == result.Fingerprint:
		decision.Hold = false
		return decision, nil
	case result.Hold, found && existing.Status == StatusHeld:
		decision.Hold = true
		hold := refreshHold(existing, in, result, now)
		if !found || existing.HeldAt.IsZero() {
			hold.HeldAt = now
		} else {
			hold.HeldAt = existing.HeldAt
		}
		hold.Status = StatusHeld
		hold.ReviewedAt = nil
		hold.ReviewedBy = ""
		hold.ReviewNote = ""
		if err := s.holds.Put(ctx, hold); err != nil {
			return Decision{}, fmt.Errorf("save scam hold: %w", err)
		}
		return decision, nil
	default:
		return decision, nil
	}
}

func (s *Service) List(ctx context.Context, query ListQuery) (List, error) {
	if s == nil || s.holds == nil {
		return List{Jobs: []Hold{}}, nil
	}
	query.Status = stringsOrHeld(query.Status)
	if err := validateListStatus(query.Status); err != nil {
		return List{}, err
	}
	return s.holds.List(ctx, query)
}

func (s *Service) Review(ctx context.Context, id, actor string, input Review, now time.Time) (Hold, error) {
	if err := input.Normalize(); err != nil {
		return Hold{}, err
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return Hold{}, ErrInvalidID
	}
	if now.IsZero() {
		now = time.Now()
	}
	now = now.UTC()
	actor = clipActor(actor)
	hold, err := s.holds.Get(ctx, id)
	if err != nil {
		return Hold{}, err
	}
	if hold.Status != StatusHeld {
		return Hold{}, ErrConflict
	}
	listingStatus := ListingActive
	hold.Status = StatusApproved
	switch input.Decision {
	case DecisionApprove:
		listingStatus = ListingActive
		hold.Status = StatusApproved
	case DecisionReject:
		listingStatus = ListingRemoved
		hold.Status = StatusRejected
	default:
		return Hold{}, &ValidationError{Fields: []FieldError{{Field: "decision", Detail: "use approve or reject"}}}
	}
	reviewed := now
	hold.ReviewedAt = &reviewed
	hold.ReviewedBy = actor
	hold.ReviewNote = input.Reason
	if s.listings != nil {
		if err := s.listings.SetScamHoldStatus(ctx, hold.JobID, listingStatus); err != nil && !isNotFound(err) {
			return Hold{}, fmt.Errorf("update listing after scam review: %w", err)
		}
	}
	if err := s.holds.Put(ctx, hold); err != nil {
		return Hold{}, fmt.Errorf("save scam review: %w", err)
	}
	return hold, nil
}

func refreshHold(existing Hold, in Input, result Result, now time.Time) Hold {
	id := holdID(in)
	hold := existing
	hold.ID = id
	hold.JobID = id
	hold.ListingID = strings.TrimSpace(in.ListingID)
	hold.Title = strings.TrimSpace(in.Title)
	hold.Company = strings.TrimSpace(in.Company)
	hold.CompanyID = strings.TrimSpace(in.CompanyID)
	hold.ApplyURL = strings.TrimSpace(in.ApplyURL)
	hold.Source = strings.TrimSpace(in.Source)
	hold.Score = result.Score
	hold.Threshold = result.Threshold
	hold.Reasons = result.Reasons
	hold.Fingerprint = result.Fingerprint
	if hold.HeldAt.IsZero() {
		hold.HeldAt = now
	}
	return hold
}

func isNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

func stringsOrHeld(status string) string {
	status = strings.TrimSpace(status)
	if status == "" {
		return StatusHeld
	}
	return status
}

func validateListStatus(status string) error {
	switch status {
	case StatusHeld, StatusApproved, StatusRejected:
		return nil
	default:
		return &ValidationError{Fields: []FieldError{{Field: "status", Detail: "use held, approved, or rejected"}}}
	}
}
