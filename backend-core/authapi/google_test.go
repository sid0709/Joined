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
	half := &GoogleSignIn{OAuth: &google.Client{ClientID: "id", ClientSecret: "secret"}, Roles: []string{auth.RoleScout}}
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
	full := &GoogleSignIn{OAuth: half.OAuth, Roles: []string{auth.RoleScout}, RedirectURL: "http://localhost:6003/auth/google/callback"}
	if !full.configured() {
		t.Fatal("client, redirect URL, and a role should be enough")
	}
}

func TestSignUpModePicksOnlyRolesTheAppOffers(t *testing.T) {
	joined := &GoogleSignIn{Roles: []string{auth.RoleCandidate, auth.RoleEmployee}}
	for mode, want := range map[string]string{
		"":                 auth.RoleCandidate,
		auth.RoleEmployee:  auth.RoleEmployee,
		auth.RoleCandidate: auth.RoleCandidate,
		auth.RoleScout:     auth.RoleCandidate,
		"admin":            auth.RoleCandidate,
	} {
		if got := joined.newRole(mode); got != want {
			t.Errorf("newRole(%q) = %q, want %q", mode, got, want)
		}
	}
	scoutwell := &GoogleSignIn{Roles: []string{auth.RoleScout}}
	for _, mode := range []string{"", auth.RoleCandidate, auth.RoleEmployee} {
		if got := scoutwell.newRole(mode); got != auth.RoleScout {
			t.Errorf("Scoutwell newRole(%q) = %q", mode, got)
		}
	}
}

func TestPasswordRoutesAreGone(t *testing.T) {
	mux := http.NewServeMux()
	Handlers{Audience: auth.AudienceJoined}.Register(mux)
	for _, path := range []string{"/v1/auth/signup", "/v1/auth/signin"} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{}`)))
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s status = %d, want 404", path, rec.Code)
		}
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
