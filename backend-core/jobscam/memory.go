package jobscam

import (
	"context"
	"sort"
	"strings"
	"sync"
)

// Memory is an in-memory Holds and Listings for tests. CI has no MongoDB.
type Memory struct {
	mu       sync.Mutex
	holds    map[string]Hold
	listings map[string]string
}

func NewMemory() *Memory {
	return &Memory{
		holds:    map[string]Hold{},
		listings: map[string]string{},
	}
}

func (m *Memory) Get(_ context.Context, id string) (Hold, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	hold, ok := m.holds[strings.TrimSpace(id)]
	if !ok {
		return Hold{}, ErrNotFound
	}
	return cloneHold(hold), nil
}

func (m *Memory) Put(_ context.Context, hold Hold) error {
	id := strings.TrimSpace(hold.ID)
	if id == "" {
		return ErrInvalidID
	}
	hold.ID = id
	hold.JobID = strings.TrimSpace(hold.JobID)
	if hold.JobID == "" {
		hold.JobID = id
	}
	if hold.Reasons == nil {
		hold.Reasons = []Reason{}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.holds[id] = cloneHold(hold)
	return nil
}

func (m *Memory) List(_ context.Context, query ListQuery) (List, error) {
	page, size := pageBounds(query.Page, query.PageSize)
	status := stringsOrHeld(query.Status)
	m.mu.Lock()
	defer m.mu.Unlock()
	rows := make([]Hold, 0, len(m.holds))
	for _, hold := range m.holds {
		if hold.Status == status {
			rows = append(rows, cloneHold(hold))
		}
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].HeldAt.Equal(rows[j].HeldAt) {
			return rows[i].ID < rows[j].ID
		}
		return rows[i].HeldAt.After(rows[j].HeldAt)
	})
	total := int64(len(rows))
	start := (page - 1) * size
	if start > total {
		start = total
	}
	end := start + size
	if end > total {
		end = total
	}
	out := rows[start:end]
	if out == nil {
		out = []Hold{}
	}
	return List{Jobs: out, Total: total, Page: page, PageSize: size, Next: nextPage(page, size, total)}, nil
}

func (m *Memory) CountFingerprint(_ context.Context, fingerprint, exceptID string) (int, error) {
	fingerprint = strings.TrimSpace(fingerprint)
	exceptID = strings.TrimSpace(exceptID)
	if fingerprint == "" {
		return 0, nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for id, hold := range m.holds {
		if id == exceptID {
			continue
		}
		if hold.Fingerprint == fingerprint {
			n++
		}
	}
	return n, nil
}

func (m *Memory) SetScamHoldStatus(_ context.Context, jobID, status string) error {
	jobID = strings.TrimSpace(jobID)
	if jobID == "" {
		return ErrInvalidID
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.listings[jobID] = status
	return nil
}

// ListingStatus is the last status Review wrote for tests.
func (m *Memory) ListingStatus(jobID string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.listings[strings.TrimSpace(jobID)]
}

func cloneHold(hold Hold) Hold {
	if hold.Reasons != nil {
		copied := make([]Reason, len(hold.Reasons))
		copy(copied, hold.Reasons)
		hold.Reasons = copied
	} else {
		hold.Reasons = []Reason{}
	}
	if hold.ReviewedAt != nil {
		at := *hold.ReviewedAt
		hold.ReviewedAt = &at
	}
	return hold
}

// Ensure Memory stays a Holds and Listings implementation.
var (
	_ Holds    = (*Memory)(nil)
	_ Listings = (*Memory)(nil)
)
