package killswitch

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

var (
	// ErrUnknown is a staff flip of a name that is not in Names.
	ErrUnknown = errors.New("unknown kill switch")
	// ErrDisabled means the feature is off. Callers map it to 503.
	ErrDisabled = errors.New("feature disabled")
	// ErrNoStore means this process has no Mongo (or memory) switch store.
	ErrNoStore = errors.New("kill switches are unavailable")
)

// Switches is the runtime lookup staff and handlers share. Nil means every
// feature is on. *Store and *Memory implement it.
type Switches interface {
	Enabled(ctx context.Context, name Name) bool
	List(ctx context.Context) ([]State, error)
	Set(ctx context.Context, name Name, enabled bool, actor, note string, now time.Time) (Result, error)
}

// On reports whether name may run. A nil Switches is on.
func On(switches Switches, ctx context.Context, name Name) bool {
	if switches == nil {
		return true
	}
	return switches.Enabled(ctx, name)
}

// Check returns ErrDisabled when name is off.
func Check(ctx context.Context, switches Switches, name Name) error {
	if On(switches, ctx, name) {
		return nil
	}
	return fmt.Errorf("%s: %w", name, ErrDisabled)
}

// WriteDisabled answers 503 for a killed feature.
func WriteDisabled(w http.ResponseWriter, name Name) {
	httpkit.WriteError(w, http.StatusServiceUnavailable, Message(name))
}

// Guard stops the request with 503 when name is off.
func Guard(switches Switches, name Name, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !On(switches, r.Context(), name) {
			WriteDisabled(w, name)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// GuardFunc is Guard for a HandlerFunc.
func GuardFunc(switches Switches, name Name, next http.HandlerFunc) http.HandlerFunc {
	return Guard(switches, name, next).ServeHTTP
}
