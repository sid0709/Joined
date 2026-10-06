package httpkit

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/scout"
)

// ScoutProblem maps a scout domain error to its problem response.
func ScoutProblem(err error) Problem {
	var fields *scout.ValidationError
	var conflict *scout.ConflictError
	var quota *scout.QuotaError
	switch {
	case errors.As(err, &fields):
		p := NewProblem(http.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid.")
		p.Errors = fields.Fields
		return p
	case errors.As(err, &quota):
		return NewProblem(http.StatusTooManyRequests, "quota_exceeded", "Daily submission limit of "+strconv.Itoa(quota.Quota.Limit)+" reached; it resets at midnight UTC.")
	case errors.As(err, &conflict):
		p := NewProblem(http.StatusConflict, "conflict", conflict.Detail)
		p.ExistingID = conflict.ExistingID
		return p
	case errors.Is(err, scout.ErrNotScout), errors.Is(err, scout.ErrForbidden):
		return NewProblem(http.StatusForbidden, "forbidden", err.Error())
	case errors.Is(err, scout.ErrTermsRequired):
		return NewProblem(http.StatusForbidden, "terms_required", err.Error())
	case errors.Is(err, scout.ErrNotFound):
		return NewProblem(http.StatusNotFound, "not_found", "Not found.")
	case errors.Is(err, scout.ErrIdempotency):
		return NewProblem(http.StatusConflict, "idempotency_key_reused", err.Error())
	case errors.Is(err, scout.ErrIdempotencyInFlight):
		return NewProblem(http.StatusConflict, "idempotency_in_progress", err.Error())
	case errors.Is(err, scout.ErrTaxFormRequired):
		return NewProblem(http.StatusUnprocessableEntity, scout.CodeTaxFormRequired, scout.ErrTaxFormRequired.Error())
	case errors.Is(err, scout.ErrScreeningBlocked):
		return NewProblem(http.StatusUnprocessableEntity, scout.CodeScreeningBlocked, scout.ErrScreeningBlocked.Error())
	case errors.Is(err, scout.ErrPayoutBlocked):
		return NewProblem(http.StatusUnprocessableEntity, "payout_blocked", err.Error())
	case errors.Is(err, scout.ErrKeyLimit):
		return NewProblem(http.StatusConflict, "key_limit", err.Error())
	case errors.Is(err, scout.ErrNotDecidable), errors.Is(err, scout.ErrAlreadyDecided):
		return NewProblem(http.StatusConflict, "conflict", err.Error())
	case errors.Is(err, scout.ErrInvalidKey):
		return NewProblem(http.StatusUnauthorized, "unauthorized", err.Error())
	default:
		slog.Error("scout", "error", err)
		return NewProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again.")
	}
}

// WriteScoutError writes the problem for err, plus rate-limit headers when a quota ran out.
func WriteScoutError(w http.ResponseWriter, err error) {
	var quota *scout.QuotaError
	if errors.As(err, &quota) {
		SetQuotaHeaders(w, quota.Quota)
		w.Header().Set("Retry-After", strconv.Itoa(max(1, int(time.Until(quota.Quota.ResetsAt).Seconds()))))
	}
	WriteProblem(w, ScoutProblem(err))
}

// SetQuotaHeaders reports the daily submission quota (docs/60 rate-limit headers).
func SetQuotaHeaders(w http.ResponseWriter, quota scout.Quota) {
	w.Header().Set("RateLimit-Limit", strconv.Itoa(quota.Limit))
	w.Header().Set("RateLimit-Remaining", strconv.Itoa(quota.Remaining))
	w.Header().Set("RateLimit-Reset", strconv.Itoa(max(0, int(time.Until(quota.ResetsAt).Seconds()))))
}
