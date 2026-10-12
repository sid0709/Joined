package httpkit

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

type copyKey struct{}

func TestRoutesRecordsTheInnermostPattern(t *testing.T) {
	inner := http.NewServeMux()
	inner.HandleFunc("GET /v1/me/jobs/{id}", func(w http.ResponseWriter, r *http.Request) {})
	outer := http.NewServeMux()
	// Like session middleware, this copies the request, so outer never sees inner's pattern.
	outer.Handle("/v1/me/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		Routes(inner).ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), copyKey{}, true)))
	}))

	var route string
	probe := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		Routes(outer).ServeHTTP(w, r)
		route = recordFrom(r.Context()).route
	})
	handler := Logging(slog.New(slog.NewJSONHandler(io.Discard, nil)), probe)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/v1/me/jobs/abc", nil))

	if route != "GET /v1/me/jobs/{id}" {
		t.Fatalf("route = %q", route)
	}
}

func TestRoutesLeavesUnmatchedBlank(t *testing.T) {
	var route = "unset"
	probe := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		Routes(http.NewServeMux()).ServeHTTP(w, r)
		route = recordFrom(r.Context()).route
	})
	Logging(slog.New(slog.NewJSONHandler(io.Discard, nil)), probe).
		ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/wp-admin", nil))
	if route != "" {
		t.Fatalf("route = %q, want blank", route)
	}
}
