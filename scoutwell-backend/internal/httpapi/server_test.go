package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServesScoutRoutesOnly(t *testing.T) {
	handler := New(nil, nil, nil, Options{})
	cases := []struct {
		method string
		path   string
		status int
	}{
		{http.MethodGet, "/v1/scout/meta", http.StatusOK},
		{http.MethodGet, "/v1/scout/me", http.StatusUnauthorized},
		{http.MethodPost, "/v1/auth/company", http.StatusNotFound},
		{http.MethodGet, "/v1/me/profile", http.StatusNotFound},
		{http.MethodGet, "/v1/admin/scout/overview", http.StatusNotFound},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, nil))
		if rec.Code != tc.status {
			t.Errorf("%s %s status = %d, want %d", tc.method, tc.path, rec.Code, tc.status)
		}
	}
}
