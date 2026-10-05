package fitscore

import (
	"context"
	"errors"
	"sync"
)

// ErrNotFound is a missing job. Handlers map it to 404.
var ErrNotFound = errors.New("job not found")

// Memory is an in-memory Catalog and Profiles for tests.
type Memory struct {
	mu       sync.Mutex
	Jobs     map[string]Job
	Profiles map[string]Profile
}

// Job returns the stored posting, or ErrNotFound.
func (m *Memory) Job(_ context.Context, id string) (Job, error) {
	if m == nil {
		return Job{}, ErrNotFound
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	job, ok := m.Jobs[id]
	if !ok {
		return Job{}, ErrNotFound
	}
	if job.ID == "" {
		job.ID = id
	}
	return job, nil
}

// Profile returns the stored hunter, or an empty profile when missing.
func (m *Memory) Profile(_ context.Context, userID string) (Profile, error) {
	if m == nil {
		return Profile{}, nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.Profiles == nil {
		return Profile{}, nil
	}
	return m.Profiles[userID], nil
}
