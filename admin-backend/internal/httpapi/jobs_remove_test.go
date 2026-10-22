package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/Joined/backend-core/jobs"
)

func TestRemoveTempJobsRejectsBadSelections(t *testing.T) {
	handler := New(jobs.NewStore(nil, "", "", "", "", ""), nil, nil, nil, Options{AdminToken: "secret"})
	for name, body := range map[string]string{
		"empty":    `{"tempJobIds":[]}`,
		"no body":  ``,
		"bad id":   `{"tempJobIds":["nope"]}`,
		"bad json": `{`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/v1/jobs/temp/remove", strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer secret")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s status = %d body = %s", name, rec.Code, rec.Body.String())
		}
	}
}

func TestRemoveTempJobsNeedsTheAdminToken(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/jobs/temp/remove", strings.NewReader(`{}`)))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", rec.Code)
	}
}
