package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStaffMutationRequiresAdminToken(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	body := strings.NewReader(`{"decision":"approve","reason":"domain matches"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/companies/company-1/decision", body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestStaffMutationRejectsBadDecision(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/jobs/job-1/review", strings.NewReader(`{"decision":"reject"}`))
	req.Header.Set("Authorization", "Bearer secret")
	req.Header.Set(adminActorHeader, "roosebelt")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "reason") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestStaffMutationWithTokenReachesReview(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/companies/company-1/decision", strings.NewReader(`{"decision":"approve"}`))
	req.Header.Set("Authorization", "Bearer secret")
	req.Header.Set(adminActorHeader, "roosebelt")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestAdminActorUsesHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/companies/x/decision", nil)
	req.Header.Set(adminActorHeader, "  Sid\n")
	if got := adminActor(req); got != "Sid" {
		t.Fatalf("actor = %q", got)
	}
	if got := adminActor(httptest.NewRequest(http.MethodGet, "/", nil)); got != defaultActor {
		t.Fatalf("default actor = %q", got)
	}
}
