package deepseek

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/aisettings"
	"github.com/sid0709/OpenSeat/backend-core/config"
)

const (
	// refreshAfter is how long a loaded setting is trusted. Staff save from the
	// console, so this is the longest a new key takes to reach analysis.
	refreshAfter = 10 * time.Second
	loadTimeout  = 3 * time.Second
)

// Reloading is the DeepSeek client job analysis, company research, and company
// autofill use. It prefers the key and model saved in the admin console and falls
// back to the environment's, picking up a change within refreshAfter. The search
// endpoint and search cap stay on the environment's defaults.
type Reloading struct {
	store    aisettings.Loader
	fallback config.DeepSeek

	mu       sync.Mutex
	client   *Client
	identity [2]string
	loadedAt time.Time
}

// NewReloading builds a client that reloads saved settings. fallback covers whatever
// staff have not saved, including a blank key.
func NewReloading(store aisettings.Loader, fallback config.DeepSeek) *Reloading {
	return &Reloading{store: store, fallback: fallback}
}

// current returns the client for the settings in force, reloading them when stale.
func (r *Reloading) current() *Client {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.client != nil && time.Since(r.loadedAt) < refreshAfter {
		return r.client
	}
	key, model := r.fallback.APIKey, r.fallback.Model
	if r.store != nil {
		ctx, cancel := context.WithTimeout(context.Background(), loadTimeout)
		saved, err := r.store.Get(ctx)
		cancel()
		switch {
		case err != nil && r.client != nil:
			slog.Warn("deepseek settings not reloaded", "error", err)
			r.loadedAt = time.Now()
			return r.client
		case err != nil:
			slog.Warn("deepseek settings unavailable, using the environment's", "error", err)
		default:
			if saved.APIKey != "" {
				key = saved.APIKey
			}
			if saved.Model != "" {
				model = saved.Model
			}
		}
	}
	r.loadedAt = time.Now()
	if identity := [2]string{key, model}; r.client == nil || identity != r.identity {
		cfg := r.fallback
		cfg.APIKey = key
		cfg.Model = model
		r.client = New(cfg)
		r.identity = identity
	}
	return r.client
}

func (r *Reloading) JSON(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, error) {
	return r.current().JSON(ctx, system, user, schema)
}

func (r *Reloading) JSONWebSearch(ctx context.Context, system, user string, schema json.RawMessage) ([]byte, []string, error) {
	return r.current().JSONWebSearch(ctx, system, user, schema)
}

func (r *Reloading) Model() string { return r.current().Model() }

func (r *Reloading) Ready() bool { return r.current().Ready() }
