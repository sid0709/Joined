package authapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

type sessionContextKey struct{}
type staffContextKey struct{}

type roleStore interface {
	Session(ctx context.Context, token string, now time.Time) (auth.Session, error)
}

type staffStore interface {
	StaffSession(ctx context.Context, token string, now time.Time) (auth.Staff, error)
}

// RequireRole wraps a handler so it only runs when the session has one of roles.
// A signed-out request gets 401. A signed-in account with the wrong role gets 403.
func RequireRole(accounts roleStore, roles []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if accounts == nil {
			httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
			return
		}
		session, err := accounts.Session(r.Context(), httpkit.BearerToken(r), time.Now())
		if errors.Is(err, auth.ErrInvalidLogin) {
			httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
			return
		}
		if err != nil {
			slog.Error("session", "error", err)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not load the session")
			return
		}
		if !hasRole(session.User.Role, roles) {
			httpkit.WriteError(w, http.StatusForbidden, roleMessage(session.User.Role))
			return
		}
		ctx := context.WithValue(r.Context(), sessionContextKey{}, session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireStaff wraps a handler so it only runs when a staff session exists.
// A signed-out request gets 401.
func RequireStaff(accounts staffStore, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if accounts == nil {
			httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
			return
		}
		staff, err := accounts.StaffSession(r.Context(), httpkit.BearerToken(r), time.Now())
		if errors.Is(err, auth.ErrInvalidLogin) {
			httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
			return
		}
		if err != nil {
			slog.Error("staff session", "error", err)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not load the session")
			return
		}
		ctx := context.WithValue(r.Context(), staffContextKey{}, staff)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Session retrieves the session stored by RequireRole.
func Session(ctx context.Context) (auth.Session, bool) {
	session, ok := ctx.Value(sessionContextKey{}).(auth.Session)
	return session, ok
}

// Staff retrieves the staff session stored by RequireStaff.
func Staff(ctx context.Context) (auth.Staff, bool) {
	staff, ok := ctx.Value(staffContextKey{}).(auth.Staff)
	return staff, ok
}

func hasRole(userRole string, allowed []string) bool {
	for _, role := range allowed {
		if userRole == role {
			return true
		}
	}
	return false
}

func roleMessage(role string) string {
	switch role {
	case auth.RoleCandidate:
		return "this account is a job seeker account"
	case auth.RoleEmployee:
		return "this account is a recruiter account"
	case auth.RoleScout:
		return "this account is a scout account"
	default:
		return "this account cannot access this resource"
	}
}
