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

func TestLogging(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	
	handler := Logging(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if RequestID(r.Context()) == "" {
			t.Error("request ID not set in context")
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()
	
	handler.ServeHTTP(rec, req)
	
	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
	
	if rec.Header().Get("X-Request-ID") == "" {
		t.Error("X-Request-ID header not set")
	}
	
	logLine := buf.String()
	if logLine == "" {
		t.Fatal("no log output")
	}
	
	var logEntry map[string]any
	if err := json.Unmarshal([]byte(logLine), &logEntry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}
	
	if logEntry["msg"] != "request" {
		t.Errorf("got msg %v, want %q", logEntry["msg"], "request")
	}
	if logEntry["request_id"] == nil {
		t.Error("request_id not in log")
	}
	if logEntry["method"] != "GET" {
		t.Errorf("got method %v, want GET", logEntry["method"])
	}
	if logEntry["path"] != "/test" {
		t.Errorf("got path %v, want /test", logEntry["path"])
	}
	if logEntry["status"] != float64(200) {
		t.Errorf("got status %v, want 200", logEntry["status"])
	}
	if logEntry["latency_ms"] == nil {
		t.Error("latency_ms not in log")
	}
}

func TestLoggingReuseRequestID(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	
	existingID := "test-request-id-123"
	
	handler := Logging(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := RequestID(r.Context()); got != existingID {
			t.Errorf("got request ID %q, want %q", got, existingID)
		}
		w.WriteHeader(http.StatusOK)
	}))
	
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Request-ID", existingID)
	rec := httptest.NewRecorder()
	
	handler.ServeHTTP(rec, req)
	
	if got := rec.Header().Get("X-Request-ID"); got != existingID {
		t.Errorf("got X-Request-ID header %q, want %q", got, existingID)
	}
	
	logLine := buf.String()
	var logEntry map[string]any
	if err := json.Unmarshal([]byte(logLine), &logEntry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}
	
	if logEntry["request_id"] != existingID {
		t.Errorf("got request_id %v, want %q", logEntry["request_id"], existingID)
	}
}

func TestLoggingWithUserID(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	
	userID := "user-123"
	
	handler := Logging(logger, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	
	req := httptest.NewRequest("GET", "/test", nil)
	req = req.WithContext(context.WithValue(req.Context(), "user_id", userID))
	rec := httptest.NewRecorder()
	
	handler.ServeHTTP(rec, req)
	
	logLine := buf.String()
	var logEntry map[string]any
	if err := json.Unmarshal([]byte(logLine), &logEntry); err != nil {
		t.Fatalf("failed to parse log JSON: %v", err)
	}
	
	if logEntry["user_id"] != userID {
		t.Errorf("got user_id %v, want %q", logEntry["user_id"], userID)
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
	
	id2 := generateRequestID()
	if id == id2 {
		t.Error("two generated request IDs are the same")
	}
}
