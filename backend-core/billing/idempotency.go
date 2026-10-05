package billing

import (
	"sync"
	"time"
)

// IdempotencyStore tracks processed webhook events to prevent duplicate handling.
type IdempotencyStore interface {
	// MarkProcessed marks an event as processed. Returns false if already processed.
	MarkProcessed(eventID string) bool
}

// MemoryIdempotencyStore is an in-memory idempotency store.
type MemoryIdempotencyStore struct {
	mu        sync.Mutex
	processed map[string]time.Time
}

// NewMemoryIdempotencyStore creates an in-memory idempotency store.
func NewMemoryIdempotencyStore() *MemoryIdempotencyStore {
	return &MemoryIdempotencyStore{
		processed: make(map[string]time.Time),
	}
}

func (m *MemoryIdempotencyStore) MarkProcessed(eventID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.processed[eventID]; exists {
		return false
	}
	m.processed[eventID] = time.Now()
	return true
}

func (m *MemoryIdempotencyStore) Cleanup(before time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, t := range m.processed {
		if t.Before(before) {
			delete(m.processed, id)
		}
	}
}
