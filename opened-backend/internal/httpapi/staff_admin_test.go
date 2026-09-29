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
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/companies/company-1/verify", body)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestStaffVerifyRequiresReason(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/companies/company-1/verify", strings.NewReader(`{"decision":"approve"}`))
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

func TestStaffReviewRejectWithoutReasonReachesStore(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/jobs/job-1/review", strings.NewReader(`{"decision":"reject"}`))
	req.Header.Set("Authorization", "Bearer secret")
	req.Header.Set(adminActorHeader, "roosebelt")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestStaffReviewRejectsBadDisposition(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/jobs/job-1/review", strings.NewReader(`{"decision":"reject","rejectDisposition":"archive"}`))
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "rejectDisposition") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestStaffTakedownRequiresReason(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/jobs/job-1/takedown", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "reason") {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

func TestStaffMutationWithTokenReachesVerify(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, nil, Options{AdminToken: "secret"})
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/companies/company-1/verify", strings.NewReader(`{"decision":"approve","reason":"domain matches"}`))
	req.Header.Set("Authorization", "Bearer secret")
	req.Header.Set(adminActorHeader, "roosebelt")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestAdminActorUsesHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/admin/companies/x/verify", nil)
	req.Header.Set(adminActorHeader, "  Sid\n")
	if got := adminActor(req); got != "Sid" {
		t.Fatalf("actor = %q", got)
	}
	if got := adminActor(httptest.NewRequest(http.MethodGet, "/", nil)); got != defaultActor {
		t.Fatalf("default actor = %q", got)
	}
}
