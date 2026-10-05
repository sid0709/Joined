package savedsearch

import (
	"context"
	"sort"
	"sync"
	"time"
)

// Memory is an in-memory Store for tests and CI (no MongoDB).
type Memory struct {
	mu   sync.Mutex
	byID map[string]SavedSearch
}

// NewMemory starts empty.
func NewMemory() *Memory {
	return &Memory{byID: map[string]SavedSearch{}}
}

func (m *Memory) Insert(_ context.Context, search SavedSearch) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if search.ID == "" {
		return ErrInvalidInput
	}
	if _, exists := m.byID[search.ID]; exists {
		return ErrInvalidInput
	}
	m.byID[search.ID] = search
	return nil
}

func (m *Memory) Get(_ context.Context, userID, id string) (SavedSearch, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	search, ok := m.byID[id]
	if !ok || search.UserID != userID {
		return SavedSearch{}, ErrNotFound
	}
	return search, nil
}

func (m *Memory) ListByUser(_ context.Context, userID string) ([]SavedSearch, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]SavedSearch, 0)
	for _, search := range m.byID {
		if search.UserID == userID {
			out = append(out, search)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].UpdatedAt.Equal(out[j].UpdatedAt) {
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		}
		return out[i].ID > out[j].ID
	})
	return out, nil
}

func (m *Memory) Replace(_ context.Context, search SavedSearch) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	existing, ok := m.byID[search.ID]
	if !ok || existing.UserID != search.UserID {
		return ErrNotFound
	}
	m.byID[search.ID] = search
	return nil
}

func (m *Memory) Delete(_ context.Context, userID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	existing, ok := m.byID[id]
	if !ok || existing.UserID != userID {
		return ErrNotFound
	}
	delete(m.byID, id)
	return nil
}

func (m *Memory) CountByUser(_ context.Context, userID string) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	count := 0
	for _, search := range m.byID {
		if search.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (m *Memory) ListDue(_ context.Context, now time.Time, limit int) ([]SavedSearch, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	limit = clampAlertLimit(limit)
	out := make([]SavedSearch, 0)
	for _, search := range m.byID {
		if search.AlertDue(now) {
			out = append(out, search)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].LastAlertedAt.Equal(out[j].LastAlertedAt) {
			return out[i].LastAlertedAt.Before(out[j].LastAlertedAt)
		}
		return out[i].ID < out[j].ID
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (m *Memory) MarkAlerted(_ context.Context, id string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	search, ok := m.byID[id]
	if !ok {
		return ErrNotFound
	}
	search.LastAlertedAt = now.UTC()
	search.UpdatedAt = now.UTC()
	m.byID[id] = search
	return nil
}
