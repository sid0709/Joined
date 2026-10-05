package httpkit

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type mockReporter struct {
	panics []any
	stacks []string
}

func (m *mockReporter) ReportPanic(ctx context.Context, err any, stack string) {
	m.panics = append(m.panics, err)
	m.stacks = append(m.stacks, stack)
}

func TestRecoveryPanic(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	reporter := &mockReporter{}
	
	handler := Recovery(logger, reporter, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	}))
	
	req := httptest.NewRequest("GET", "/test", nil)
	req = req.WithContext(withRequestID(req.Context(), "test-req-123"))
	rec := httptest.NewRecorder()
	
	handler.ServeHTTP(rec, req)
	
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	
	var response map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	
	if response["error"] != "Internal server error" {
		t.Errorf("got error %q, want %q", response["error"], "Internal server error")
	}
	
	logLine := buf.String()
	if logLine == "" {
		t.Fatal("no log output")
	}
	
	var logEntry map[string]any
	if err := json.Unmarshal([]byte(logLine), &logEntry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}
	
	if logEntry["msg"] != "panic recovered" {
		t.Errorf("got msg %v, want %q", logEntry["msg"], "panic recovered")
	}
	if logEntry["request_id"] != "test-req-123" {
		t.Errorf("got request_id %v, want test-req-123", logEntry["request_id"])
	}
	if logEntry["error"] == nil {
		t.Error("error not in log")
	}
	if !strings.Contains(logEntry["error"].(string), "test panic") {
		t.Errorf("error does not contain panic message: %v", logEntry["error"])
	}
	if logEntry["stack"] == nil {
		t.Error("stack not in log")
	}
	
	if len(reporter.panics) != 1 {
		t.Fatalf("got %d panics reported, want 1", len(reporter.panics))
	}
	if reporter.panics[0] != "test panic" {
		t.Errorf("got panic %v, want %q", reporter.panics[0], "test panic")
	}
	if len(reporter.stacks) != 1 || reporter.stacks[0] == "" {
		t.Error("stack not reported to error reporter")
	}
}

func TestRecoveryNoPanic(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	reporter := &mockReporter{}
	
	handler := Recovery(logger, reporter, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()
	
	handler.ServeHTTP(rec, req)
	
	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
	
	if buf.Len() != 0 {
		t.Errorf("got log output when no panic occurred: %s", buf.String())
	}
	
	if len(reporter.panics) != 0 {
		t.Errorf("got %d panics reported, want 0", len(reporter.panics))
	}
}

func TestRecoveryNilReporter(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	
	handler := Recovery(logger, nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	}))
	
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()
	
	handler.ServeHTTP(rec, req)
	
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	
	logLine := buf.String()
	if logLine == "" {
		t.Fatal("no log output")
	}
}
