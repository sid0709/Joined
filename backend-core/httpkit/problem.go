package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/sid0709/OpenSeat/joined-backend/internal/scout"
)

const problemContentType = "application/problem+json"

// problem is an RFC 9457 problem details body (docs/60-api-conventions.md).
type problem struct {
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

func newProblem(status int, code, detail string) problem {
	title := problemTitles[code]
	if title == "" {
		title = http.StatusText(status)
	}
	return problem{Type: "about:blank", Title: title, Status: status, Code: code, Detail: detail}
}

func writeProblem(w http.ResponseWriter, p problem) {
	w.Header().Set("Content-Type", problemContentType)
	w.WriteHeader(p.Status)
	if err := json.NewEncoder(w).Encode(p); err != nil {
		slog.Error("write problem", "error", err)
	}
}

// scoutProblem maps a scout domain error to its problem response.
func scoutProblem(err error) problem {
	var fields *scout.ValidationError
	var conflict *scout.ConflictError
	var quota *scout.QuotaError
	switch {
	case errors.As(err, &fields):
		p := newProblem(http.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid.")
		p.Errors = fields.Fields
		return p
	case errors.As(err, &quota):
		return newProblem(http.StatusTooManyRequests, "quota_exceeded", "Daily submission limit of "+strconv.Itoa(quota.Quota.Limit)+" reached; it resets at midnight UTC.")
	case errors.As(err, &conflict):
		p := newProblem(http.StatusConflict, "conflict", conflict.Detail)
		p.ExistingID = conflict.ExistingID
		return p
	case errors.Is(err, scout.ErrNotScout), errors.Is(err, scout.ErrForbidden):
		return newProblem(http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, scout.ErrTermsRequired):
		return newProblem(http.StatusForbidden, "terms_required", err.Error())
	case errors.Is(err, scout.ErrNotFound):
		return newProblem(http.StatusNotFound, "not_found", "Not found.")
	case errors.Is(err, scout.ErrIdempotency):
		return newProblem(http.StatusConflict, "idempotency_key_reused", err.Error())
	case errors.Is(err, scout.ErrIdempotencyInFlight):
		return newProblem(http.StatusConflict, "idempotency_in_progress", err.Error())
	case errors.Is(err, scout.ErrPayoutBlocked):
		return newProblem(http.StatusUnprocessableEntity, "payout_blocked", err.Error())
	case errors.Is(err, scout.ErrKeyLimit):
		return newProblem(http.StatusConflict, "key_limit", err.Error())
	case errors.Is(err, scout.ErrNotDecidable), errors.Is(err, scout.ErrAlreadyDecided):
		return newProblem(http.StatusConflict, "conflict", err.Error())
	case errors.Is(err, scout.ErrInvalidKey):
		return newProblem(http.StatusUnauthorized, "unauthorized", err.Error())
	default:
		slog.Error("scout", "error", err)
		return newProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again.")
	}
}

// writeScoutError writes the problem for err, plus rate-limit headers when a quota ran out.
func writeScoutError(w http.ResponseWriter, err error) {
	var quota *scout.QuotaError
	if errors.As(err, &quota) {
		setQuotaHeaders(w, quota.Quota)
		w.Header().Set("Retry-After", strconv.Itoa(max(1, int(time.Until(quota.Quota.ResetsAt).Seconds()))))
	}
	writeProblem(w, scoutProblem(err))
}

// setQuotaHeaders reports the daily submission quota (docs/60 rate-limit headers).
func setQuotaHeaders(w http.ResponseWriter, quota scout.Quota) {
	w.Header().Set("RateLimit-Limit", strconv.Itoa(quota.Limit))
	w.Header().Set("RateLimit-Remaining", strconv.Itoa(quota.Remaining))
	w.Header().Set("RateLimit-Reset", strconv.Itoa(max(0, int(time.Until(quota.ResetsAt).Seconds()))))
}
