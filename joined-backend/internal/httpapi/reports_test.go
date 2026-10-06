package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/staff"
)

func TestJobReportRoute(t *testing.T) {
	handler := New(nil, nil, nil, nil, staff.NewMem(), nil, Options{Sessions: testSessions()})

	t.Run("get stays unmounted", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/reports", nil)
		req.Header.Set("Authorization", "Bearer candidate-token")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", rec.Code)
		}
	})

	t.Run("signed out is 401", func(t *testing.T) {
		req := reportRequest(`{"subjectType":"job","subjectId":"job-1","reasonCode":"scam_job"}`)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("not a good fit is rejected", func(t *testing.T) {
		req := reportRequest(`{"subjectType":"job","subjectId":"job-1","reasonCode":"not_a_good_fit"}`)
		req.Header.Set("Authorization", "Bearer candidate-token")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
		if strings.Contains(rec.Body.String(), "not_a_good_fit") {
			t.Fatalf("body echoed the rejected reason: %s", rec.Body.String())
		}
	})

	t.Run("candidate files a job report", func(t *testing.T) {
		req := reportRequest(`{"subjectType":"job","subjectId":"job-1","reasonCode":"scam_job","details":"asks for a fee"}`)
		req.Header.Set("Authorization", "Bearer candidate-token")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})
}

func reportRequest(body string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/v1/reports", strings.NewReader(body))
	req.Header.Set("Idempotency-Key", "report-key-1")
	req.Header.Set("Content-Type", "application/json")
	return req
}
