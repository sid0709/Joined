package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// offlineModel is a migration model without an API key.
type offlineModel struct{}

func (offlineModel) Model() string { return "deepseek-flash" }
func (offlineModel) Ready() bool   { return false }
func (offlineModel) JSON(context.Context, string, string, json.RawMessage) ([]byte, error) {
	return nil, nil
}
func (offlineModel) JSONWebSearch(context.Context, string, string, json.RawMessage) ([]byte, []string, error) {
	return nil, nil, nil
}

func postMigration(t *testing.T, handler http.Handler, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, path, strings.NewReader(body)))
	return recorder
}

func TestMigrationAIStepsNeedTheDeepSeekKey(t *testing.T) {
	for name, opts := range map[string]Options{
		"no model":     {},
		"model no key": {Migration: MigrationOptions{Model: offlineModel{}}},
	} {
		handler := New(nil, nil, nil, nil, opts)
		for _, step := range []string{"jobs-analyze", "companies-research"} {
			recorder := postMigration(t, handler, "/v1/migration/"+step, `{}`)
			if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "DEEPSEEK_API_KEY") {
				t.Fatalf("%s %s: %d %s", name, step, recorder.Code, recorder.Body)
			}
		}
	}
}

func TestMigrationRejectsUnknownStepsAndBadBodies(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{Migration: MigrationOptions{Model: offlineModel{}}})
	if recorder := postMigration(t, handler, "/v1/migration/everything", ``); recorder.Code != http.StatusNotFound {
		t.Fatalf("unknown step: %d", recorder.Code)
	}
	if recorder := postMigration(t, handler, "/v1/migration/jobs-analyze", `{`); recorder.Code != http.StatusBadRequest {
		t.Fatalf("bad body: %d", recorder.Code)
	}
	ids := make([]string, maxMigrationSelection+1)
	for i := range ids {
		ids[i] = "x"
	}
	body, _ := json.Marshal(map[string]any{"tempJobIds": ids})
	if recorder := postMigration(t, handler, "/v1/migration/jobs-analyze", string(body)); recorder.Code != http.StatusBadRequest {
		t.Fatalf("too many jobs: %d", recorder.Code)
	}
	body, _ = json.Marshal(map[string]any{"companyIds": ids})
	if recorder := postMigration(t, handler, "/v1/migration/companies-research", string(body)); recorder.Code != http.StatusBadRequest {
		t.Fatalf("too many companies: %d %s", recorder.Code, recorder.Body.String())
	}
	if recorder := postMigration(t, handler, "/v1/migration/jobs-copy/cancel", ``); recorder.Code != http.StatusConflict {
		t.Fatalf("cancel idle: %d", recorder.Code)
	}
}
