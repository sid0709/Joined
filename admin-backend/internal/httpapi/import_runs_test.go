package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

func TestImportRunsRequiresAdminToken(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/jobs/import-runs", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestImportRunsEmptyWhenDisabled(t *testing.T) {
	log := jobs.NewMemoryRunLog()
	handler := New(nil, nil, nil, nil, Options{
		AdminToken: "secret",
		Import: ImportOptions{
			Enabled: false,
			Sources: []jobs.SourceStatus{{ID: jobs.AthensSourceID, Enabled: false}},
			Runs:    log,
		},
	})
	req := httptest.NewRequest(http.MethodGet, "/v1/jobs/import-runs", nil)
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	var body jobs.ImportRunsResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Enabled {
		t.Fatal("enabled should be false")
	}
	if len(body.Runs) != 0 {
		t.Fatalf("runs = %#v", body.Runs)
	}
	if len(body.Sources) != 1 || body.Sources[0].ID != jobs.AthensSourceID || body.Sources[0].Enabled {
		t.Fatalf("sources = %#v", body.Sources)
	}
}

func TestImportRunsReturnsLoggedRuns(t *testing.T) {
	log := jobs.NewMemoryRunLog()
	if err := log.Append(t.Context(), jobs.ImportRun{ID: "run-1", Status: jobs.ImportRunDisabled}); err != nil {
		t.Fatal(err)
	}
	handler := New(nil, nil, nil, nil, Options{
		AdminToken: "secret",
		Import: ImportOptions{
			Enabled: false,
			Runs:    log,
		},
	})
	req := httptest.NewRequest(http.MethodGet, "/v1/jobs/import-runs", nil)
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	var body jobs.ImportRunsResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Runs) != 1 || body.Runs[0].ID != "run-1" {
		t.Fatalf("runs = %#v", body.Runs)
	}
}
