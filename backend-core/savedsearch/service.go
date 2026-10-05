package savedsearch

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Service is the user-scoped CRUD API and the DueAlerts hook.
type Service struct {
	store Store
}

// NewService wraps store. store must not be nil.
func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) Create(ctx context.Context, userID string, in Input, now time.Time) (SavedSearch, error) {
	if s.store == nil {
		return SavedSearch{}, ErrMissingStore
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return SavedSearch{}, ErrUnauthorized
	}
	search, err := buildSearch(userID, in, now)
	if err != nil {
		return SavedSearch{}, err
	}
	count, err := s.store.CountByUser(ctx, userID)
	if err != nil {
		return SavedSearch{}, fmt.Errorf("count saved searches: %w", err)
	}
	if count >= MaxPerUser {
		return SavedSearch{}, ErrLimitReached
	}
	if err := s.store.Insert(ctx, search); err != nil {
		return SavedSearch{}, err
	}
	return search, nil
}

func (s *Service) Get(ctx context.Context, userID, id string) (SavedSearch, error) {
	if s.store == nil {
		return SavedSearch{}, ErrMissingStore
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return SavedSearch{}, ErrUnauthorized
	}
	if !isPublicID(id) {
		return SavedSearch{}, ErrNotFound
	}
	search, err := s.store.Get(ctx, userID, id)
	if err != nil {
		return SavedSearch{}, err
	}
	return search, nil
}

func (s *Service) List(ctx context.Context, userID string) ([]SavedSearch, error) {
	if s.store == nil {
		return nil, ErrMissingStore
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, ErrUnauthorized
	}
	items, err := s.store.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []SavedSearch{}
	}
	return items, nil
}

func (s *Service) Update(ctx context.Context, userID, id string, patch Patch, now time.Time) (SavedSearch, error) {
	if s.store == nil {
		return SavedSearch{}, ErrMissingStore
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return SavedSearch{}, ErrUnauthorized
	}
	existing, err := s.Get(ctx, userID, id)
	if err != nil {
		return SavedSearch{}, err
	}
	updated, err := applyPatch(existing, patch, now)
	if err != nil {
		return SavedSearch{}, err
	}
	if err := s.store.Replace(ctx, updated); err != nil {
		return SavedSearch{}, err
	}
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, userID, id string) error {
	if s.store == nil {
		return ErrMissingStore
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return ErrUnauthorized
	}
	if !isPublicID(id) {
		return ErrNotFound
	}
	return s.store.Delete(ctx, userID, id)
}

// ListDue implements DueAlerts for the future alert sender.
func (s *Service) ListDue(ctx context.Context, now time.Time, limit int) ([]SavedSearch, error) {
	if s.store == nil {
		return nil, ErrMissingStore
	}
	items, err := s.store.ListDue(ctx, now, clampAlertLimit(limit))
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []SavedSearch{}
	}
	return items, nil
}

// MarkAlerted implements DueAlerts. Call it after a successful send.
func (s *Service) MarkAlerted(ctx context.Context, id string, now time.Time) error {
	if s.store == nil {
		return ErrMissingStore
	}
	if !isPublicID(id) {
		return ErrNotFound
	}
	if now.IsZero() {
		now = time.Now()
	}
	return s.store.MarkAlerted(ctx, id, now)
}

func buildSearch(userID string, in Input, now time.Time) (SavedSearch, error) {
	if now.IsZero() {
		now = time.Now()
	}
	now = now.UTC()
	query := truncateRunes(strings.TrimSpace(in.Query), MaxQueryLength)
	filters := normalizeFilters(in.Filters)
	if err := filters.valid(); err != nil {
		return SavedSearch{}, err
	}
	frequency := normalizeFrequency(in.AlertFrequency)
	if !frequency.valid() {
		return SavedSearch{}, ErrInvalidInput
	}
	id, err := newPublicID()
	if err != nil {
		return SavedSearch{}, fmt.Errorf("saved search id: %w", err)
	}
	return SavedSearch{
		ID:             id,
		UserID:         userID,
		Name:           normalizeName(in.Name, query),
		Query:          query,
		Filters:        filters,
		AlertFrequency: frequency,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func applyPatch(existing SavedSearch, patch Patch, now time.Time) (SavedSearch, error) {
	if now.IsZero() {
		now = time.Now()
	}
	now = now.UTC()
	next := existing
	if patch.Name != nil {
		next.Name = normalizeName(*patch.Name, next.Query)
	}
	if patch.Query != nil {
		next.Query = truncateRunes(strings.TrimSpace(*patch.Query), MaxQueryLength)
		if patch.Name == nil && existing.Name == normalizeName("", existing.Query) {
			next.Name = normalizeName("", next.Query)
		}
	}
	if patch.Filters != nil {
		next.Filters = normalizeFilters(*patch.Filters)
	}
	if err := next.Filters.valid(); err != nil {
		return SavedSearch{}, err
	}
	if patch.AlertFrequency != nil {
		frequency := normalizeFrequency(*patch.AlertFrequency)
		if !frequency.valid() {
			return SavedSearch{}, ErrInvalidInput
		}
		next.AlertFrequency = frequency
	}
	next.UpdatedAt = now
	return next, nil
}
