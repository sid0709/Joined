package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/google"
)

type rejectStaffAccounts struct{}

func (rejectStaffAccounts) StaffSession(context.Context, string, time.Time) (auth.Staff, error) {
	return auth.Staff{}, auth.ErrInvalidLogin
}

func (rejectStaffAccounts) StaffSignout(context.Context, string) error { return nil }

func (rejectStaffAccounts) StaffSignin(context.Context, auth.GoogleIdentity, string, string, time.Time) (string, auth.Staff, error) {
	return "", auth.Staff{}, auth.ErrNotStaff
}

func (rejectStaffAccounts) SaveGoogleState(context.Context, string, auth.GoogleState, time.Time) error {
	return nil
}

func (rejectStaffAccounts) TakeGoogleState(context.Context, string, time.Time) (auth.GoogleState, error) {
	return auth.GoogleState{}, auth.ErrGoogleState
}

func staffSignIn() StaffSignIn {
	return StaffSignIn{
		Accounts:    auth.NewStore(nil, "", ""),
		OAuth:       &google.Client{ClientID: "id", ClientSecret: "secret"},
		RedirectURL: "http://localhost:6010/auth/google/callback",
		Domain:      "joinedhq.com",
	}
}

func serve(handler http.Handler, method, path string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
	return recorder
}

func TestStaffSignInIsRequiredOnlyWhenGoogleIsSetUp(t *testing.T) {
	if (StaffSignIn{}).Required() {
		t.Fatal("empty settings should not require sign-in")
	}
	missingRedirect := staffSignIn()
	missingRedirect.RedirectURL = ""
	if missingRedirect.Required() {
		t.Fatal("a client without a redirect should not require sign-in")
	}
	if !staffSignIn().Required() {
		t.Fatal("a configured client should require sign-in")
	}

	open := New(nil, nil, nil, nil, Options{})
	if recorder := serve(open, http.MethodGet, "/v1/auth/session"); recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"required":false`) {
		t.Fatalf("open console session: %d %s", recorder.Code, recorder.Body)
	}
}

func TestStaffRoutesNeedASessionOnceSignInIsRequired(t *testing.T) {
	handler := New(nil, nil, nil, nil, Options{Staff: staffSignIn()})
	for _, path := range []string{"/v1/migration", "/v1/jobs", "/v1/auth/session"} {
		if recorder := serve(handler, http.MethodGet, path); recorder.Code != http.StatusUnauthorized {
			t.Errorf("%s without a session: %d %s", path, recorder.Code, recorder.Body)
		}
	}
	if recorder := serve(handler, http.MethodPost, "/v1/auth/signout"); recorder.Code != http.StatusNoContent {
		t.Fatalf("sign out without a session: %d", recorder.Code)
	}
	if recorder := serve(New(nil, nil, nil, nil, Options{}), http.MethodPost, "/v1/auth/google/start"); recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("start without Google: %d", recorder.Code)
	}
}

func TestAdminRouteGroupsRejectUnsignedAndUserTokens(t *testing.T) {
	staff := staffSignIn()
	staff.Accounts = rejectStaffAccounts{}
	handler := New(nil, nil, nil, nil, Options{Staff: staff})
	groups := []string{
		"/v1/settings",
		"/v1/jobs",
		"/v1/jobs/temp",
		"/v1/companies",
		"/v1/migration",
		"/v1/reports",
		"/v1/admin/cases",
		"/v1/admin/jobs",
		"/v1/admin/companies/verifications",
		"/v1/admin/scout/meta",
		"/v1/admin/acorn-ai",
		"/v1/admin/deepseek",
	}
	for _, path := range groups {
		t.Run(path+" no token", func(t *testing.T) {
			if recorder := serve(handler, http.MethodGet, path); recorder.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d body = %s", recorder.Code, recorder.Body)
			}
		})
		t.Run(path+" user token", func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set(staffSessionHeader, "user-session-token")
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d body = %s", rec.Code, rec.Body)
			}
		})
	}
}
