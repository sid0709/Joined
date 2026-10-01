package httpapi

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/joined-backend/internal/employer"
)

func TestCompanyAnalyticsForbiddenIs403(t *testing.T) {
	_, err := employer.AggregateAnalytics("user", employer.RoleInterviewer, employer.NewAccessIndex(nil), nil, nil, nil, url.Values{}, time.Now(), time.UTC)
	rec := httptest.NewRecorder()
	if writeEmployer(rec, err) {
		t.Fatal("expected analytics.view to be rejected")
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), employer.PermAnalyticsView) {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestCompanyAnalyticsHappyPathJSON(t *testing.T) {
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	entered := now.AddDate(0, 0, -2)
	query := url.Values{}
	query.Set("jobId", "job-1")
	snap, err := employer.AggregateAnalytics("user", employer.RoleOwner, employer.NewAccessIndex(nil), []employer.Job{
		{ID: "job-1", Views: 4},
	}, []employer.Applicant{
		{ID: "a", JobID: "job-1", ColumnID: "hired", Assisted: "direct", AppliedOn: entered, StageEnteredAt: entered},
	}, []employer.Interview{
		{ID: "i", JobID: "job-1", Status: "attended", Date: "2026-09-28"},
	}, query, now, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	writeJSON(rec, http.StatusOK, snap)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	body := rec.Body.String()
	for _, piece := range []string{`"source":"einstein"`, `"jobId":"job-1"`, `"id":"hired"`, `"attended":1`, `"isProxy":false`} {
		if !strings.Contains(body, piece) {
			t.Fatalf("missing %s in %s", piece, body)
		}
	}
}
