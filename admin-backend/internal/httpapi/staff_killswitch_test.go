package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

func TestKillSwitchRoutesNeedAdminToken(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/admin/kill-switches", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestKillSwitchListAndFlip(t *testing.T) {
	mem := killswitch.NewMemory(killswitch.Defaults{killswitch.Signup: true})
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret", KillSwitches: mem})

	req := httptest.NewRequest(http.MethodGet, "/v1/admin/kill-switches", nil)
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"signup"`) {
		t.Fatalf("list = %d %s", rec.Code, rec.Body.String())
	}

	body := strings.NewReader(`{"enabled":false,"note":"incident"}`)
	put := httptest.NewRequest(http.MethodPut, "/v1/admin/kill-switches/signup", body)
	put.Header.Set("Authorization", "Bearer secret")
	put.Header.Set(adminActorHeader, "roosebelt")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, put)
	if rec.Code != http.StatusOK {
		t.Fatalf("put = %d %s", rec.Code, rec.Body.String())
	}
	var result killswitch.Result
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.State.Enabled || result.AuditID == "" || result.State.Source != "override" {
		t.Fatalf("result = %+v", result)
	}
	if mem.Enabled(put.Context(), killswitch.Signup) {
		t.Fatal("signup should be off")
	}
}

func TestKillSwitchUnknownNameAndMissingEnabled(t *testing.T) {
	mem := killswitch.NewMemory(nil)
	handler := New(nil, nil, nil, nil, Options{AdminToken: "secret", KillSwitches: mem})

	req := httptest.NewRequest(http.MethodPut, "/v1/admin/kill-switches/nope", strings.NewReader(`{"enabled":false}`))
	req.Header.Set("Authorization", "Bearer secret")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("unknown = %d %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPut, "/v1/admin/kill-switches/signup", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer secret")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("missing enabled = %d %s", rec.Code, rec.Body.String())
	}
}

func TestJobImportKillSwitchBlocksCopySteps(t *testing.T) {
	mem := killswitch.NewMemory(killswitch.Defaults{killswitch.JobImports: false})
	handler := New(nil, nil, nil, nil, Options{KillSwitches: mem})
	for _, step := range []string{"jobs-copy", "companies-copy"} {
		rec := postMigration(t, handler, "/v1/migration/"+step, `{}`)
		if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "Job imports") {
			t.Fatalf("%s: %d %s", step, rec.Code, rec.Body.String())
		}
	}
}
