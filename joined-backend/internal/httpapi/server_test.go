package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStaffAndScoutRoutesLiveInTheirOwnServices(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, Options{})
	for _, path := range []string{"/v1/settings", "/v1/jobs/temp", "/v1/companies", "/v1/admin/cases", "/v1/reports", "/v1/scout/meta"} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s status = %d, want 404", path, rec.Code)
		}
	}
}
