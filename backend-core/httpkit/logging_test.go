package httpkit

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func parseLogLine(t *testing.T, raw string) map[string]any {
	t.Helper()
	raw = strings.TrimSpace(raw)
	if raw == "" {
		t.Fatal("no log output")
	}
	lines := strings.Split(raw, "\n")
	if len(lines) != 1 {
		t.Fatalf("got %d log lines, want 1:\n%s", len(lines), raw)
	}
	var entry map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &entry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}
	return entry
}

func TestWrapLogging(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := Wrap(logger, nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if RequestID(r.Context()) == "" {
			t.Error("request ID not set in context")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
	if rec.Header().Get(RequestIDHeader) == "" {
		t.Error("X-Request-ID header not set")
	}

	entry := parseLogLine(t, buf.String())
	if entry["msg"] != "request" {
		t.Errorf("got msg %v, want request", entry["msg"])
	}
	if entry["request_id"] == nil || entry["request_id"] == "" {
		t.Error("request_id not in log")
	}
	if entry["method"] != http.MethodGet {
		t.Errorf("got method %v, want GET", entry["method"])
	}
	if entry["path"] != "/test" {
		t.Errorf("got path %v, want /test", entry["path"])
	}
	if entry["status"] != float64(http.StatusOK) {
		t.Errorf("got status %v, want 200", entry["status"])
	}
	if entry["latency_ms"] == nil {
		t.Error("latency_ms not in log")
	}
}

func TestWrapReuseRequestID(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	existingID := "test-request-id-123"

	handler := Wrap(logger, nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := RequestID(r.Context()); got != existingID {
			t.Errorf("got request ID %q, want %q", got, existingID)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set(RequestIDHeader, existingID)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get(RequestIDHeader); got != existingID {
		t.Errorf("got X-Request-ID header %q, want %q", got, existingID)
	}
	entry := parseLogLine(t, buf.String())
	if entry["request_id"] != existingID {
		t.Errorf("got request_id %v, want %q", entry["request_id"], existingID)
	}
}

func TestSetUserID(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	userID := "user-123"

	handler := Wrap(logger, nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		SetUserID(r.Context(), userID)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	entry := parseLogLine(t, buf.String())
	if entry["user_id"] != userID {
		t.Errorf("got user_id %v, want %q", entry["user_id"], userID)
	}
}

func TestWrapHandlerNeverWritesIsLogged200(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := Wrap(logger, nil, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
	entry := parseLogLine(t, buf.String())
	if entry["status"] != float64(http.StatusOK) {
		t.Errorf("got status %v, want 200", entry["status"])
	}
}

func TestGenerateRequestID(t *testing.T) {
	id := generateRequestID()
	if len(id) != 16 {
		t.Errorf("got request ID length %d, want 16", len(id))
	}
	for _, c := range id {
		if !strings.ContainsRune("0123456789abcdef", c) {
			t.Errorf("request ID %q contains non-hex character %q", id, c)
		}
	}
	if id == generateRequestID() {
		t.Error("two generated request IDs are the same")
	}
}
