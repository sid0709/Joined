package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/joined-backend/internal/employer"
)

func TestFeedbackGateConflictIs409(t *testing.T) {
	rec := httptest.NewRecorder()
	if writeEmployer(rec, &employer.FeedbackGateError{Reason: "Add team notes before advancing this candidate."}) {
		t.Fatal("expected the gate error to be handled")
	}
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "Add team notes before advancing this candidate.") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}
