package httpkit

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"time"
)

const RequestIDHeader = "X-Request-ID"

type contextKey int

const requestRecordKey contextKey = 1

// requestRecord is the mutable per-request bag Logging stores on the context.
type requestRecord struct {
	id       string
	userID   string
	panicErr string
	stack    string
}

func recordFrom(ctx context.Context) *requestRecord {
	rec, _ := ctx.Value(requestRecordKey).(*requestRecord)
	return rec
}

// RequestID returns the request ID from the context, or "" if none is set.
func RequestID(ctx context.Context) string {
	if rec := recordFrom(ctx); rec != nil {
		return rec.id
	}
	return ""
}

// SetUserID records the authenticated user for the request log line.
// Session and role middleware should call this once they resolve the user.
func SetUserID(ctx context.Context, userID string) {
	if rec := recordFrom(ctx); rec != nil {
		rec.userID = userID
	}
}

func generateRequestID() string {
	var bytes [8]byte
	_, _ = rand.Read(bytes[:])
	return hex.EncodeToString(bytes[:])
}

// Wrap orders Recovery inside Logging so a panic still has a request id and
// produces one structured log line. All service mains should call this.
func Wrap(logger *slog.Logger, reporter ErrorReporter, next http.Handler) http.Handler {
	return Logging(logger, Recovery(reporter, next))
}

// Logging assigns a request id, captures status and latency, and writes one
// structured JSON line. Recovery must sit inside it so panics still log.
func Logging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		requestID := r.Header.Get(RequestIDHeader)
		if requestID == "" {
			requestID = generateRequestID()
		}
		rec := &requestRecord{id: requestID}
		r = r.WithContext(context.WithValue(r.Context(), requestRecordKey, rec))
		w.Header().Set(RequestIDHeader, requestID)

		wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(wrapped, r)

		status := wrapped.status
		if rec.panicErr != "" {
			status = http.StatusInternalServerError
		}
		attrs := []any{
			"request_id", requestID,
			"method", r.Method,
			"path", r.URL.Path,
			"status", status,
			"latency_ms", time.Since(start).Milliseconds(),
		}
		if rec.userID != "" {
			attrs = append(attrs, "user_id", rec.userID)
		}
		if rec.panicErr != "" {
			attrs = append(attrs, "error", rec.panicErr, "stack", rec.stack)
			logger.Error("request", attrs...)
			return
		}
		logger.Info("request", attrs...)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (w *responseWriter) WriteHeader(status int) {
	if !w.wrote {
		w.status = status
		w.wrote = true
		w.ResponseWriter.WriteHeader(status)
	}
}

func (w *responseWriter) Write(b []byte) (int, error) {
	if !w.wrote {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

func (w *responseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func (w *responseWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (w *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errNoHijacker
	}
	return h.Hijack()
}

var errNoHijacker = errors.New("httpkit: ResponseWriter does not implement http.Hijacker")
