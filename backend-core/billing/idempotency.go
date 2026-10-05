package billing

import (
	"sync"
	"time"
)

// IdempotencyStore tracks processed webhook events to prevent duplicate handling.
type IdempotencyStore interface {
	// IsProcessed checks if an event has been processed.
	IsProcessed(eventID string) bool
	// MarkProcessed marks an event as processed.
	MarkProcessed(eventID string)
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

func (m *MemoryIdempotencyStore) IsProcessed(eventID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, exists := m.processed[eventID]
	return exists
}

func (m *MemoryIdempotencyStore) MarkProcessed(eventID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.processed[eventID] = time.Now()
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
