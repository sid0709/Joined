package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEmployerRoutesStayUnderCompanyPrefix(t *testing.T) {
	for _, route := range (&Server{}).employerRoutes() {
		if !strings.HasPrefix(route.path, "/v1/company/") {
			t.Errorf("%s %s is outside /v1/company/", route.method, route.path)
		}
	}
}

func TestEmployerRoutesDoNot404OnJoinedRouter(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, Options{CompanyMode: true})
	for _, route := range (&Server{}).employerRoutes() {
		path := sampleEmployerPath(route.path)
		req := httptest.NewRequest(route.method, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code == http.StatusNotFound {
			t.Errorf("%s %s 404ed: %s", route.method, path, rec.Body.String())
		}
	}
}

func sampleEmployerPath(path string) string {
	replacer := strings.NewReplacer(
		"{id}", "route-1",
		"{approvalId}", "approval-1",
		"{itemId}", "item-1",
		"{jobId}", "job-1",
	)
	path = replacer.Replace(path)
	if strings.Contains(path, "free-busy") {
		return path + "?from=2026-10-01&to=2026-10-14"
	}
	return path
}
