package killswitch

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Memory is an in-memory Switches for tests. Defaults are env; Set writes
// an override the same way Mongo would.
type Memory struct {
	mu       sync.Mutex
	defaults Defaults
	docs     map[Name]document
	audits   []storedAudit
}

// NewMemory starts with defaults and no overrides.
func NewMemory(defaults Defaults) *Memory {
	return &Memory{defaults: complete(defaults), docs: map[Name]document{}}
}

// Enabled reports whether name may run.
func (m *Memory) Enabled(_ context.Context, name Name) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.stateLocked(name).Enabled
}

// List is every known switch.
func (m *Memory) List(context.Context) ([]State, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]State, 0, len(Names))
	for _, name := range Names {
		out = append(out, m.stateLocked(name))
	}
	return out, nil
}

// Set writes an override and an audit row.
func (m *Memory) Set(_ context.Context, name Name, enabled bool, actor, note string, now time.Time) (Result, error) {
	if !Known(name) {
		return Result{}, ErrUnknown
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if now.IsZero() {
		now = time.Now()
	}
	now = now.UTC()
	actor = cleanActor(actor)
	note = cleanNote(note)
	doc := document{
		ID:        string(name),
		Enabled:   enabled,
		UpdatedAt: now,
		UpdatedBy: actor,
		Note:      note,
	}
	m.docs[name] = doc
	id := fmt.Sprintf("audit-%d", len(m.audits)+1)
	action := auditActionDisable
	if enabled {
		action = auditActionEnable
	}
	m.audits = append(m.audits, storedAudit{
		Action:      action,
		SubjectType: auditSubject,
		SubjectID:   string(name),
		Actor:       actor,
		Note:        note,
		At:          now,
	})
	return Result{State: m.stateLocked(name), AuditID: id}, nil
}

// Audits returns recorded admin_audit rows in insertion order.
func (m *Memory) Audits() []storedAudit {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]storedAudit, len(m.audits))
	copy(out, m.audits)
	return out
}

func (m *Memory) stateLocked(name Name) State {
	if doc, ok := m.docs[name]; ok {
		return State{
			Name:      name,
			Enabled:   doc.Enabled,
			Source:    sourceOverride,
			UpdatedAt: doc.UpdatedAt,
			UpdatedBy: doc.UpdatedBy,
			Note:      doc.Note,
		}
	}
	enabled := true
	if m.defaults != nil {
		if v, ok := m.defaults[name]; ok {
			enabled = v
		}
	}
	return State{Name: name, Enabled: enabled, Source: sourceEnv}
}
