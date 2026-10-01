package authapi

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/google"
)

func TestGoogleRoutesAnswer503UntilConfigured(t *testing.T) {
	half := &GoogleSignIn{OAuth: &google.Client{ClientID: "id", ClientSecret: "secret"}, Role: auth.RoleScout}
	for _, g := range []*GoogleSignIn{nil, half} {
		mux := http.NewServeMux()
		Handlers{Audience: auth.RoleScout, Google: g}.Register(mux)
		for _, path := range []string{"/v1/auth/google/start", "/v1/auth/google/callback"} {
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{}`)))
			if rec.Code != http.StatusServiceUnavailable {
				t.Errorf("%s with %+v: status = %d", path, g, rec.Code)
			}
		}
	}
	full := &GoogleSignIn{OAuth: half.OAuth, Role: auth.RoleScout, RedirectURL: "http://localhost:3003/api/auth/google/callback"}
	if !full.configured() {
		t.Fatal("client, redirect URL, and role should be enough")
	}
}

func TestGoogleFailuresSayWhatToDo(t *testing.T) {
	cases := []struct {
		err    error
		status int
	}{
		{auth.ErrGoogleState, http.StatusBadRequest},
		{google.ErrInvalidGrant, http.StatusBadRequest},
		{errors.New("dial tcp: timeout"), http.StatusBadGateway},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		writeGoogleFailure(rec, tc.err)
		if rec.Code != tc.status {
			t.Errorf("%v: status = %d, want %d", tc.err, rec.Code, tc.status)
		}
	}
	rec := httptest.NewRecorder()
	writeAuthResult(rec, "", auth.Session{}, auth.ErrGoogleMismatch)
	if rec.Code != http.StatusConflict {
		t.Errorf("mismatch status = %d", rec.Code)
	}
}
