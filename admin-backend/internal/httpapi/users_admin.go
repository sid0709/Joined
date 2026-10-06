package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/billing"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

const (
	userSubjectType = "user"

	actionUserSuspend   = "user.suspend"
	actionUserRestore   = "user.unsuspend"
	actionPremiumCancel = "user.premium_cancel"
	actionPremiumRefund = "user.premium_refund"
	actionUserReveal    = "user.reveal"

	routeAdminUsers = "/v1/admin/users"
)

// AccountAdmin is staff lookup and login suspend. *auth.Store implements it.
type AccountAdmin interface {
	AdminLookup(ctx context.Context, email, id string) (auth.AdminAccount, error)
	SetSuspended(ctx context.Context, userID string, suspended bool, now time.Time) error
}

// PremiumAdmin cancels or refunds Joined Premium without calling live Stripe.
type PremiumAdmin interface {
	AdminStatus(ctx context.Context, userID string) (bool, string, error)
	AdminCancel(ctx context.Context, userID, reason string, now time.Time) error
	AdminRefund(ctx context.Context, userID, reason string, amountCents int64, now time.Time) error
}

func (s *Server) registerUsers(mux *http.ServeMux) {
	mux.HandleFunc("GET "+routeAdminUsers, s.adminFindUser)
	mux.HandleFunc("GET "+routeAdminUsers+"/{id}", s.adminUser)
	mux.HandleFunc("POST "+routeAdminUsers+"/{id}/premium/cancel", s.adminCancelPremium)
	mux.HandleFunc("POST "+routeAdminUsers+"/{id}/premium/refund", s.adminRefundPremium)
	mux.HandleFunc("POST "+routeAdminUsers+"/{id}/suspend", s.adminSuspendUser)
	mux.HandleFunc("POST "+routeAdminUsers+"/{id}/unsuspend", s.adminUnsuspendUser)
	mux.HandleFunc("POST "+routeAdminUsers+"/{id}/reveal", s.adminRevealUser)
}

type userReason struct {
	Reason      string `json:"reason"`
	AmountCents int64  `json:"amount_cents"`
}

type userTimeline struct {
	At    time.Time `json:"at"`
	Label string    `json:"label"`
}

type adminUserView struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Email         string         `json:"email"`
	Role          string         `json:"role"`
	Suspended     bool           `json:"suspended"`
	Premium       bool           `json:"premium"`
	PremiumStatus string         `json:"premiumStatus"`
	Timeline      []userTimeline `json:"timeline"`
}

type userActionResult struct {
	User    adminUserView `json:"user"`
	AuditID string        `json:"auditId"`
}

func (s *Server) adminFindUser(w http.ResponseWriter, r *http.Request) {
	if !s.usersReady(w) {
		return
	}
	email := strings.TrimSpace(r.URL.Query().Get("email"))
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if email == "" && id == "" {
		httpkit.WriteError(w, http.StatusBadRequest, "email or id is required")
		return
	}
	view, err := s.userView(r.Context(), email, id, false)
	if !writeUser(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, view)
}

func (s *Server) adminUser(w http.ResponseWriter, r *http.Request) {
	if !s.usersReady(w) {
		return
	}
	view, err := s.userView(r.Context(), "", r.PathValue("id"), false)
	if !writeUser(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, view)
}

func (s *Server) adminCancelPremium(w http.ResponseWriter, r *http.Request) {
	s.userMutation(w, r, actionPremiumCancel, func(ctx context.Context, id, reason string, body userReason, now time.Time) error {
		if s.premium == nil {
			return errPremiumUnavailable
		}
		return s.premium.AdminCancel(ctx, id, reason, now)
	})
}

func (s *Server) adminRefundPremium(w http.ResponseWriter, r *http.Request) {
	s.userMutation(w, r, actionPremiumRefund, func(ctx context.Context, id, reason string, body userReason, now time.Time) error {
		if s.premium == nil {
			return errPremiumUnavailable
		}
		return s.premium.AdminRefund(ctx, id, reason, body.AmountCents, now)
	})
}

func (s *Server) adminSuspendUser(w http.ResponseWriter, r *http.Request) {
	s.userMutation(w, r, actionUserSuspend, func(ctx context.Context, id, _ string, _ userReason, now time.Time) error {
		return s.accounts.SetSuspended(ctx, id, true, now)
	})
}

func (s *Server) adminUnsuspendUser(w http.ResponseWriter, r *http.Request) {
	s.userMutation(w, r, actionUserRestore, func(ctx context.Context, id, _ string, _ userReason, now time.Time) error {
		return s.accounts.SetSuspended(ctx, id, false, now)
	})
}

func (s *Server) adminRevealUser(w http.ResponseWriter, r *http.Request) {
	s.userMutation(w, r, actionUserReveal, func(context.Context, string, string, userReason, time.Time) error {
		return nil
	})
}

func (s *Server) userMutation(w http.ResponseWriter, r *http.Request, action string, apply func(context.Context, string, string, userReason, time.Time) error) {
	if !s.usersReady(w) || !s.staffReady(w) {
		return
	}
	var body userReason
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &body) {
		return
	}
	reason := strings.TrimSpace(body.Reason)
	if reason == "" {
		httpkit.WriteError(w, http.StatusUnprocessableEntity, "reason is required")
		return
	}
	id := r.PathValue("id")
	now := time.Now().UTC()
	if err := apply(r.Context(), id, reason, body, now); !writeUser(w, err) {
		return
	}
	auditID, err := s.staff.WriteAudit(r.Context(), action, userSubjectType, id, adminActor(r), reason, now)
	if !writeUser(w, err) {
		return
	}
	view, err := s.userView(r.Context(), "", id, action == actionUserReveal)
	if !writeUser(w, err) {
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, userActionResult{User: view, AuditID: auditID})
}

func (s *Server) userView(ctx context.Context, email, id string, reveal bool) (adminUserView, error) {
	account, err := s.accounts.AdminLookup(ctx, email, id)
	if err != nil {
		return adminUserView{}, err
	}
	view := adminUserView{
		ID: account.ID, Name: account.Name, Role: account.Role,
		Email: maskEmail(account.Email), Suspended: !account.SuspendedAt.IsZero(),
		Timeline: []userTimeline{{At: account.CreatedAt, Label: "signup"}},
	}
	if reveal {
		view.Email = account.Email
	}
	if s.premium != nil {
		premium, status, err := s.premium.AdminStatus(ctx, account.ID)
		if err != nil && !errors.Is(err, billing.ErrNotFound) {
			return adminUserView{}, err
		}
		view.Premium = premium
		view.PremiumStatus = status
	}
	if s.staff != nil {
		audits, err := s.staff.AuditsFor(ctx, account.ID)
		if err != nil {
			return adminUserView{}, err
		}
		for _, entry := range audits {
			view.Timeline = append(view.Timeline, userTimeline{At: entry.At, Label: entry.Action})
		}
	}
	return view, nil
}

func (s *Server) usersReady(w http.ResponseWriter) bool {
	if s.accounts == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "user lookup is unavailable")
		return false
	}
	return true
}

var errPremiumUnavailable = errors.New("premium billing is unavailable")

func writeUser(w http.ResponseWriter, err error) bool {
	if err == nil {
		return true
	}
	switch {
	case errors.Is(err, auth.ErrNotFound):
		httpkit.WriteError(w, http.StatusNotFound, "user not found")
	case errors.Is(err, auth.ErrInvalidInput), errors.Is(err, billing.ErrInvalidEvent):
		httpkit.WriteError(w, http.StatusUnprocessableEntity, "check the reason and try again")
	case errors.Is(err, errPremiumUnavailable):
		httpkit.WriteError(w, http.StatusServiceUnavailable, err.Error())
	case errors.Is(err, billing.ErrNotFound):
		httpkit.WriteError(w, http.StatusNotFound, "no premium subscription")
	default:
		httpkit.WriteError(w, http.StatusInternalServerError, "could not update the user")
	}
	return false
}

func maskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "***"
	}
	local := parts[0]
	if len(local) == 1 {
		return "*@" + parts[1]
	}
	return local[:1] + strings.Repeat("*", len(local)-1) + "@" + parts[1]
}
