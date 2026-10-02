package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/google"
)

func staffSignIn() StaffSignIn {
	return StaffSignIn{
		Accounts:    auth.NewStore(nil, "", ""),
		OAuth:       &google.Client{ClientID: "id", ClientSecret: "secret"},
		RedirectURL: "http://localhost:3010/auth/google/callback",
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
