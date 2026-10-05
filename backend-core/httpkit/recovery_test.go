package httpkit

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net"
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

func TestWrapPanicWithoutRequestID(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	reporter := &mockReporter{}

	handler := Wrap(logger, reporter, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("test panic")
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	requestID := rec.Header().Get(RequestIDHeader)
	if requestID == "" {
		t.Fatal("X-Request-ID header not set")
	}

	var response map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response["error"] != "Internal server error" {
		t.Errorf("got error %q, want %q", response["error"], "Internal server error")
	}

	entry := parseLogLine(t, buf.String())
	if entry["level"] != "ERROR" {
		t.Errorf("got level %v, want ERROR", entry["level"])
	}
	if entry["msg"] != "request" {
		t.Errorf("got msg %v, want request", entry["msg"])
	}
	if entry["request_id"] != requestID {
		t.Errorf("log request_id %v does not match response header %q", entry["request_id"], requestID)
	}
	if entry["method"] != http.MethodGet {
		t.Errorf("got method %v, want GET", entry["method"])
	}
	if entry["path"] != "/test" {
		t.Errorf("got path %v, want /test", entry["path"])
	}
	if entry["status"] != float64(http.StatusInternalServerError) {
		t.Errorf("got status %v, want 500", entry["status"])
	}
	if entry["latency_ms"] == nil {
		t.Error("latency_ms not in log")
	}
	errMsg, _ := entry["error"].(string)
	if !strings.Contains(errMsg, "test panic") {
		t.Errorf("error does not contain panic message: %v", entry["error"])
	}
	if entry["stack"] == nil || entry["stack"] == "" {
		t.Error("stack not in log")
	}
	if len(reporter.panics) != 1 || reporter.panics[0] != "test panic" {
		t.Errorf("got panics %v, want [test panic]", reporter.panics)
	}
	if len(reporter.stacks) != 1 || reporter.stacks[0] == "" {
		t.Error("stack not reported to error reporter")
	}
}

func TestWrapNoPanic(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	reporter := &mockReporter{}

	handler := Wrap(logger, reporter, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusOK)
	}
	entry := parseLogLine(t, buf.String())
	if entry["level"] != "INFO" {
		t.Errorf("got level %v, want INFO", entry["level"])
	}
	if len(reporter.panics) != 0 {
		t.Errorf("got %d panics reported, want 0", len(reporter.panics))
	}
}

func TestWrapPanicWithUserID(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := Wrap(logger, nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		SetUserID(r.Context(), "user-456")
		panic("user panic")
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	entry := parseLogLine(t, buf.String())
	if entry["user_id"] != "user-456" {
		t.Errorf("got user_id %v, want user-456", entry["user_id"])
	}
	if entry["level"] != "ERROR" {
		t.Errorf("got level %v, want ERROR", entry["level"])
	}
}

func TestWrapRePanicsErrAbortHandler(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	handler := Wrap(logger, nil, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic(http.ErrAbortHandler)
	}))

	defer func() {
		if err := recover(); err != http.ErrAbortHandler {
			t.Fatalf("got %v, want ErrAbortHandler", err)
		}
		if buf.Len() != 0 {
			t.Errorf("logged abort handler: %s", buf.String())
		}
	}()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/test", nil))
	t.Fatal("expected panic")
}

func TestWrapDoesNotWrite500AfterHeaders(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	handler := Wrap(logger, nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("partial"))
		panic("late panic")
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/test", nil))

	if rec.Code != http.StatusCreated {
		t.Errorf("got status %d, want %d", rec.Code, http.StatusCreated)
	}
	if rec.Body.String() != "partial" {
		t.Errorf("got body %q, want %q", rec.Body.String(), "partial")
	}
	entry := parseLogLine(t, buf.String())
	if entry["status"] != float64(http.StatusInternalServerError) {
		t.Errorf("got logged status %v, want 500", entry["status"])
	}
}

type hijackableRecorder struct {
	*httptest.ResponseRecorder
	hijacked bool
	flushed  bool
}

func (h *hijackableRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h.hijacked = true
	return nil, nil, nil
}

func (h *hijackableRecorder) Flush() {
	h.flushed = true
	h.ResponseRecorder.Flush()
}

func TestResponseWriterSupportsHijackAndFlush(t *testing.T) {
	inner := &hijackableRecorder{ResponseRecorder: httptest.NewRecorder()}
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := Wrap(logger, nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hijacker, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("handler writer is not http.Hijacker")
		}
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Fatal("handler writer is not http.Flusher")
		}
		unwrapper, ok := w.(interface{ Unwrap() http.ResponseWriter })
		if !ok {
			t.Fatal("handler writer has no Unwrap")
		}
		if unwrapper.Unwrap() != inner {
			t.Errorf("Unwrap() = %v, want inner recorder", unwrapper.Unwrap())
		}
		if _, _, err := hijacker.Hijack(); err != nil {
			t.Fatalf("Hijack: %v", err)
		}
		flusher.Flush()
	}))

	handler.ServeHTTP(inner, httptest.NewRequest(http.MethodGet, "/test", nil))
	if !inner.hijacked {
		t.Error("Hijack did not reach the inner writer")
	}
	if !inner.flushed {
		t.Error("Flush did not reach the inner writer")
	}
}

func TestNewReporter(t *testing.T) {
	if _, ok := NewReporter("").(NoOpReporter); !ok {
		t.Fatal("empty DSN should return NoOpReporter")
	}

	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	if _, ok := NewReporter("https://example.invalid/dsn").(NoOpReporter); !ok {
		t.Fatal("set DSN should still return NoOpReporter")
	}
	if !strings.Contains(buf.String(), "no error tracker adapter is installed yet") {
		t.Errorf("warning not logged: %s", buf.String())
	}
}
