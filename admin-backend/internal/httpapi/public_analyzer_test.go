package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func analyzerCall(t *testing.T, handler http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestPublicAnalyzerRoutesSkipAdminAndStaffAuth(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AdminToken: "admin-secret", AnalyzerToken: "analyzer-secret"})
	rec := analyzerCall(t, handler, http.MethodGet, "/v1/public/analyzer/jobs", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing analyzer token: %d %s", rec.Code, rec.Body.String())
	}
	rec = analyzerCall(t, handler, http.MethodPost, "/v1/public/analyzer/jobs/507f1f77bcf86cd799439011/analysis", `{`, "analyzer-secret")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("with analyzer token should bypass admin auth: %d %s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/settings", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("staff routes still need admin token: %d", rec.Code)
	}
}

func TestPublicAnalyzerRejectsInvalidAnalysisBodies(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AnalyzerToken: "analyzer-secret"})
	rec := analyzerCall(t, handler, http.MethodPost, "/v1/public/analyzer/jobs/507f1f77bcf86cd799439011/analysis", `{`, "analyzer-secret")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("job body: %d %s", rec.Code, rec.Body.String())
	}
	rec = analyzerCall(t, handler, http.MethodPost, "/v1/public/analyzer/companies/co-1/analysis", `{"company":{"name":""},"sources":[]}`, "analyzer-secret")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("company body: %d %s", rec.Code, rec.Body.String())
	}
}

func TestPublicAnalyzerDisabledWithoutTokenConfig(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{})
	rec := analyzerCall(t, handler, http.MethodGet, "/v1/public/analyzer/companies", "", "anything")
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "ANALYZER_API_TOKEN") {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}
