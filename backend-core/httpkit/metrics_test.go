package httpkit

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func TestWrapExportsRequestMetricsByRoute(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/metrics-test/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	handler := Wrap(slog.New(slog.NewJSONHandler(io.Discard, nil)), nil, Routes(mux))
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/v1/metrics-test/abc123", nil))

	rec := httptest.NewRecorder()
	promhttp.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body := rec.Body.String()
	want := `http_request_duration_seconds_count{method="GET",route="GET /v1/metrics-test/{id}",status="418"} 1`
	if !strings.Contains(body, want) {
		t.Fatalf("metrics missing %s", want)
	}
	if strings.Contains(body, "abc123") {
		t.Fatal("a path id leaked into a label")
	}
}
