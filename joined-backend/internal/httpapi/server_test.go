package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/auth/authtest"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
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

func TestNilEmailSenderFallsBackToLog(t *testing.T) {
	if _, ok := emailSenderOrDev(nil).(auth.DevEmailSender); !ok {
		t.Fatal("nil sender should fall back to DevEmailSender")
	}
	handler := New(nil, nil, nil, nil, nil, nil, Options{})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/signup", strings.NewReader(`{`))
	handler.ServeHTTP(rec, req)
	if rec.Code == http.StatusServiceUnavailable {
		t.Fatalf("nil EmailSender should still serve email routes, got 503: %s", rec.Body.String())
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for invalid JSON, body=%s", rec.Code, rec.Body.String())
	}
}

func TestSignupKillSwitchOnJoinedAPI(t *testing.T) {
	switches := killswitch.NewMemory(killswitch.Defaults{killswitch.Signup: false})
	handler := New(nil, authtest.NewStore(), nil, nil, nil, nil, Options{KillSwitches: switches})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/signup", strings.NewReader(`{"email":"a@b.co","password":"password123","name":"A"}`))
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
}
