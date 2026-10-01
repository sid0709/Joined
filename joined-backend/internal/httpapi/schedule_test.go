package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/joined-backend/internal/candidate"
)

func TestWritePublicScheduleMapsLockErrors(t *testing.T) {
	cases := []struct {
		err    error
		status int
		body   string
	}{
		{err: candidate.ErrNotFound, status: http.StatusNotFound, body: "not found"},
		{err: candidate.ErrInvalidInput, status: http.StatusBadRequest, body: candidate.ErrInvalidInput.Error()},
		{err: candidate.ErrSlotNotOffered, status: http.StatusBadRequest, body: candidate.ErrSlotNotOffered.Error()},
		{err: candidate.ErrScheduleExpired, status: http.StatusGone, body: candidate.ErrScheduleExpired.Error()},
		{err: candidate.ErrScheduleTaken, status: http.StatusConflict, body: candidate.ErrScheduleTaken.Error()},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		if writePublicSchedule(rec, tc.err) {
			t.Fatal("expected the error to be handled")
		}
		if rec.Code != tc.status || !strings.Contains(rec.Body.String(), tc.body) {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	}
	rec := httptest.NewRecorder()
	if !writePublicSchedule(rec, nil) {
		t.Fatal("nil error should pass through")
	}
}
