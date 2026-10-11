package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/monitoring"
)

// monitoringTimeout bounds one system snapshot: every query runs in parallel.
const monitoringTimeout = 15 * time.Second

func (s *Server) registerMonitoring(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/monitoring/system", s.getSystemMonitoring)
}

// getSystemMonitoring answers the system page for ?range=1h|24h|7d.
func (s *Server) getSystemMonitoring(w http.ResponseWriter, r *http.Request) {
	if s.prometheus == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "System monitoring is off: set PROMETHEUS_URL.")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), monitoringTimeout)
	defer cancel()
	snapshot, err := monitoring.LoadSystem(ctx, s.prometheus, monitoring.ParseRange(r.URL.Query().Get("range")), time.Now())
	if err != nil {
		slog.Error("system monitoring", "error", err)
		status := http.StatusInternalServerError
		if errors.Is(err, monitoring.ErrUnavailable) || errors.Is(err, context.DeadlineExceeded) {
			status = http.StatusBadGateway
		}
		httpkit.WriteError(w, status, "Prometheus did not answer. Try again.")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, snapshot)
}
