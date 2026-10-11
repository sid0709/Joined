// Package metrics holds the Prometheus metrics the Go services export. Prometheus
// scrapes them from a listener of their own (METRICS_ADDR), which nginx never proxies.
package metrics

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	// Path is where the metrics listener answers.
	Path = "/metrics"
	// UnmatchedRoute labels a request no mux pattern served (404s, scanners), so
	// random paths never become label values.
	UnmatchedRoute = "unmatched"
	readHeaderTimeout = 5 * time.Second
)

// Search paths for SearchServed.
const (
	SearchRanked   = "ranked"
	SearchFallback = "fallback"
	SearchCatalog  = "catalog"
)

// requestBuckets spans fast cache hits to the slowest synchronous handlers.
var requestBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30}

var (
	requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "Time to serve an HTTP request, by mux route, method, and status.",
		Buckets: requestBuckets,
	}, []string{"route", "method", "status"})

	searchServed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "joined_search_served_total",
		Help: "Job searches by the path that answered them: ranked, Mongo fallback, or the plain catalog.",
	}, []string{"path"})

	rankingEventsDropped = promauto.NewCounter(prometheus.CounterOpts{
		Name: "joined_ranking_events_dropped_total",
		Help: "Ranking events dropped because the writer's buffer was full.",
	})
)

// ObserveRequest records one served request. route is the mux pattern that
// served it ("GET /v1/jobs/{id}"), or "" when none did.
func ObserveRequest(route, method string, status int, took time.Duration) {
	if route == "" {
		route = UnmatchedRoute
	}
	requestDuration.WithLabelValues(route, method, strconv.Itoa(status)).Observe(took.Seconds())
}

// SearchServed counts one job search answered by path (SearchRanked, SearchFallback, SearchCatalog).
func SearchServed(path string) {
	searchServed.WithLabelValues(path).Inc()
}

// RankingEventDropped counts one ranking event lost to a full buffer.
func RankingEventDropped() {
	rankingEventsDropped.Inc()
}

// Serve answers Path on addr in the background. A blank addr leaves metrics off.
func Serve(addr string) {
	if addr == "" {
		return
	}
	mux := http.NewServeMux()
	mux.Handle("GET "+Path, promhttp.Handler())
	server := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: readHeaderTimeout}
	go func() {
		slog.Info("metrics listening", "addr", addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("metrics server", "error", err)
		}
	}()
}
