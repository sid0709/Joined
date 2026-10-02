package aisettings

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/openai"
)

const (
	// refreshAfter is how long a loaded setting is trusted. Staff save from another
	// process, so this is the longest a new key takes to reach Acorn.
	refreshAfter = 10 * time.Second
	loadTimeout  = 3 * time.Second
)

// Model is Acorn's language model. It uses the key and model staff saved in the
// admin console and falls back to the environment's, picking up a change within
// refreshAfter. It satisfies acorn.Model.
type Model struct {
	store    Loader
	fallback config.OpenAI

	mu       sync.Mutex
	client   *openai.Client
	identity [2]string
	loadedAt time.Time
}

// Loader reads the saved settings. *Store is the real one.
type Loader interface {
	Get(ctx context.Context) (Settings, error)
}

// NewModel builds the model. fallback is used for whatever staff have not saved.
func NewModel(store Loader, fallback config.OpenAI) *Model {
	return &Model{store: store, fallback: fallback}
}

// current returns the client for the settings in force, reloading them when stale.
func (m *Model) current() *openai.Client {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.client != nil && time.Since(m.loadedAt) < refreshAfter {
		return m.client
	}
	key, model := m.fallback.APIKey, m.fallback.Model
	ctx, cancel := context.WithTimeout(context.Background(), loadTimeout)
	defer cancel()
	saved, err := m.store.Get(ctx)
	switch {
	case err != nil && m.client != nil:
		// Keep serving with the last settings rather than dropping to the environment's.
		slog.Warn("acorn ai settings not reloaded", "error", err)
		m.loadedAt = time.Now()
		return m.client
	case err != nil:
		slog.Warn("acorn ai settings unavailable, using the environment's", "error", err)
	default:
		if saved.APIKey != "" {
			key = saved.APIKey
		}
		if saved.Model != "" {
			model = saved.Model
		}
	}
	m.loadedAt = time.Now()
	if identity := [2]string{key, model}; m.client == nil || identity != m.identity {
		m.client = openai.New(key, model, m.fallback.BaseURL)
		m.identity = identity
	}
	return m.client
}

func (m *Model) JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error) {
	return m.current().JSON(ctx, system, user, schema)
}

func (m *Model) Model() string { return m.current().Model() }

func (m *Model) Ready() bool { return m.current().Ready() }
