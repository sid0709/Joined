package httpkit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type stubPing struct {
	err error
}

func (s stubPing) Ping(context.Context) error { return s.err }

func TestHealthOKWithoutOptionalMonitoring(t *testing.T) {
	t.Setenv("SENTRY_DSN", "")
	t.Setenv("UPTIME_PING_URL", "")
	handler := Health(stubPing{})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rec.Code)
	}
}

func TestNotifyUptimeEmptyIsNoop(t *testing.T) {
	if err := NotifyUptime(context.Background(), "  "); err != nil {
		t.Fatal(err)
	}
}

func TestNotifyUptime(t *testing.T) {
	ok := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method %s", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(ok.Close)
	if err := NotifyUptime(context.Background(), ok.URL); err != nil {
		t.Fatal(err)
	}

	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "secret-body", http.StatusBadGateway)
	}))
	t.Cleanup(bad.Close)
	err := NotifyUptime(context.Background(), bad.URL)
	if err == nil || err.Error() != "uptime ping status 502" {
		t.Fatalf("err = %v", err)
	}
	if strings.Contains(err.Error(), "secret-body") {
		t.Fatalf("body leaked: %v", err)
	}
}
