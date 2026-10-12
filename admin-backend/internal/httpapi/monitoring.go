package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/sid0709/Joined/admin-backend/internal/migration"
	"github.com/sid0709/Joined/backend-core/httpkit"
	"github.com/sid0709/Joined/backend-core/jobs"
	"github.com/sid0709/Joined/backend-core/monitoring"
	"github.com/sid0709/Joined/backend-core/staff"
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
	now := time.Now()
	snapshot, err := monitoring.LoadSystem(ctx, s.prometheus, monitoring.ParseRange(r.URL.Query().Get("range")), now)
	if err != nil {
		slog.Error("system monitoring", "error", err)
		status := http.StatusInternalServerError
		if errors.Is(err, monitoring.ErrUnavailable) || errors.Is(err, context.DeadlineExceeded) {
			status = http.StatusBadGateway
		}
		httpkit.WriteError(w, status, "Prometheus did not answer. Try again.")
		return
	}
	if s.statusPage != nil {
		from := now.UTC().AddDate(0, 0, -(monitoring.HistoryDays - 1)).Format("2006-01-02")
		uptime, herr := s.statusPage.Uptime(ctx, from)
		if herr != nil {
			slog.Warn("monitoring history", "error", herr)
		} else {
			snapshot.AttachDays(now, uptime)
		}
	}
	snapshot.Product.Queues = s.queueDepths(ctx)
	httpkit.WriteJSON(w, http.StatusOK, snapshot)
}

func (s *Server) queueDepths(ctx context.Context) []monitoring.QueueStat {
	var out []monitoring.QueueStat
	if s.scouts != nil {
		overview, err := s.scouts.AdminOverview(ctx)
		if err != nil {
			slog.Warn("monitoring queue", "queue", "scouts", "error", err)
		} else {
			out = append(out,
				monitoring.QueueStat{Name: "Scout review", Count: overview.NeedsReview},
				monitoring.QueueStat{Name: "Payouts waiting", Count: overview.PendingPayouts},
			)
		}
	}
	if s.staff != nil {
		out = append(out, s.staffQueue("Company claims", func() (int64, error) {
			list, err := s.staff.ListVerifications(ctx, staff.VerificationQuery{Status: jobs.VerificationPending, Page: 1, PageSize: 1})
			return list.Total, err
		}))
		out = append(out, s.staffQueue("Open cases", func() (int64, error) {
			list, err := s.staff.ListCases(ctx, staff.CaseQuery{Status: staff.StatusOpen, Page: 1, PageSize: 1})
			return list.Total, err
		}))
		out = append(out, s.staffQueue("Open reports", func() (int64, error) {
			list, err := s.staff.ListReports(ctx, staff.ReportQuery{Status: staff.StatusOpen, Page: 1, PageSize: 1})
			return list.Total, err
		}))
	}
	if s.migration != nil {
		var running int64
		for _, run := range s.migration.Runs() {
			if run.Status == migration.Running {
				running++
			}
		}
		out = append(out, monitoring.QueueStat{Name: "Migration runs", Count: running})
	}
	return out
}

func (s *Server) staffQueue(name string, count func() (int64, error)) monitoring.QueueStat {
	n, err := count()
	if err != nil {
		slog.Warn("monitoring queue", "queue", name, "error", err)
		return monitoring.QueueStat{Name: name}
	}
	return monitoring.QueueStat{Name: name, Count: n}
}
