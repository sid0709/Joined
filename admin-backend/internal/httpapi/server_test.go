package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEveryRouteButHealthNeedsTheAdminToken(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret"})
	for _, path := range []string{"/v1/settings", "/v1/jobs/temp", "/v1/companies/company-1/logo", "/v1/admin/scout/meta", "/v1/unknown"} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s status = %d body = %s", path, rec.Code, rec.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/scout/meta", nil)
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("with token status = %d body = %s", rec.Code, rec.Body.String())
	}
}
