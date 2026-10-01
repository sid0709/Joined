package httpkit

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/sid0709/OpenSeat/backend-core/scout"
)

const (
	ProblemContentType = "application/problem+json"
	IdempotencyHeader  = "Idempotency-Key"
)

// Problem is an RFC 9457 problem details body (docs/60-api-conventions.md).
type Problem struct {
	Type       string             `json:"type"`
	Title      string             `json:"title"`
	Status     int                `json:"status"`
	Code       string             `json:"code"`
	Detail     string             `json:"detail"`
	Errors     []scout.FieldError `json:"errors,omitempty"`
	ExistingID string             `json:"existing_id,omitempty"`
}

var problemTitles = map[string]string{
	"validation_failed":       "Validation failed",
	"unauthorized":            "Unauthorized",
	"forbidden":               "Forbidden",
	"not_found":               "Not found",
	"conflict":                "Conflict",
	"quota_exceeded":          "Daily quota exceeded",
	"terms_required":          "Scout terms not accepted",
	"idempotency_key_reused":  "Idempotency-Key reused",
	"idempotency_in_progress": "Request in progress",
	"payout_blocked":          "Payout not available",
	"key_limit":               "API key limit reached",
	"internal_error":          "Internal error",
	"invalid_request":         "Invalid request",
}

func NewProblem(status int, code, detail string) Problem {
	title := problemTitles[code]
	if title == "" {
		title = http.StatusText(status)
	}
	return Problem{Type: "about:blank", Title: title, Status: status, Code: code, Detail: detail}
}

func WriteProblem(w http.ResponseWriter, p Problem) {
	w.Header().Set("Content-Type", ProblemContentType)
	w.WriteHeader(p.Status)
	if err := json.NewEncoder(w).Encode(p); err != nil {
		slog.Error("write problem", "error", err)
	}
}

// DecodeJSON reads a JSON body, answering 400 with a problem on bad JSON.
func DecodeJSON(w http.ResponseWriter, r *http.Request, limit int64, dest any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	if err := decoder.Decode(dest); err != nil && !errors.Is(err, io.EOF) {
		WriteProblem(w, NewProblem(http.StatusBadRequest, "invalid_request", "Body must be valid JSON."))
		return false
	}
	return true
}

// ReadBody reads the raw body, answering 413 with a problem when it is over limit.
func ReadBody(w http.ResponseWriter, r *http.Request, limit int64) ([]byte, bool) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, limit))
	if err != nil {
		WriteProblem(w, NewProblem(http.StatusRequestEntityTooLarge, "invalid_request", "Body is too large."))
		return nil, false
	}
	return body, true
}
