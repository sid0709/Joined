package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/Joined/backend-core/httpkit"
)

// statusTimeout bounds building the public status page.
const statusTimeout = 15 * time.Second

// statusCacheControl lets browsers and proxies reuse the page as long as the
// server does (statuspage.PageTTL).
const statusCacheControl = "public, max-age=30"

// getStatus answers joinedhq.com/status: live component status, 90 days of
// uptime, and incidents. Public; never personalized.
func (s *Server) getStatus(w http.ResponseWriter, r *http.Request) {
	if s.status == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "status page is not configured")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), statusTimeout)
	defer cancel()
	page, err := s.status.Page(ctx, time.Now())
	if err != nil {
		slog.Error("status page", "error", err)
		httpkit.WriteError(w, http.StatusServiceUnavailable, "status is temporarily unavailable")
		return
	}
	w.Header().Set("Cache-Control", statusCacheControl)
	httpkit.WriteJSON(w, http.StatusOK, page)
}
