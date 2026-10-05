package acornapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/acorn-backend/acorn"
	"github.com/sid0709/OpenSeat/backend-core/google"
)

func TestGoogleStartNeedsConfiguration(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	rec := call(handler, http.MethodPost, "/v1/auth/google/start", "{}", nil, "")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured start = %d, want 503", rec.Code)
	}
}

func TestGoogleStartReturnsConsentURL(t *testing.T) {
	accounts := &fakeAccounts{}
	handler, gw := New(accounts, nil, acorn.New(fakeModel{}), Options{
		Google:            &google.Client{ClientID: "client", ClientSecret: "secret"},
		GoogleRedirectURL: "http://localhost:6005/auth/google/callback",
	})
	t.Cleanup(gw.Close)

	rec := call(handler, http.MethodPost, "/v1/auth/google/start", "{}", nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("start = %d %s", rec.Code, rec.Body.String())
	}
	var body struct {
		URL   string `json:"url"`
		State string `json:"state"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(body.URL, "accounts.google.com") || body.State == "" {
		t.Fatalf("start body = %+v", body)
	}
	if !strings.Contains(body.URL, "redirect_uri=http%3A%2F%2Flocalhost%3A6005%2Fauth%2Fgoogle%2Fcallback") {
		t.Fatalf("redirect missing from %s", body.URL)
	}
	if accounts.googleState != body.State || accounts.googleVerifier == "" {
		t.Fatalf("saved state %q verifier %q", accounts.googleState, accounts.googleVerifier)
	}
}

func TestGoogleCallbackRejectsUnknownState(t *testing.T) {
	accounts := &fakeAccounts{}
	handler, gw := New(accounts, nil, acorn.New(fakeModel{}), Options{
		Google:            &google.Client{ClientID: "client", ClientSecret: "secret"},
		GoogleRedirectURL: "http://localhost:6005/auth/google/callback",
	})
	t.Cleanup(gw.Close)

	rec := call(handler, http.MethodPost, "/v1/auth/google/callback", `{"code":"abc","state":"missing"}`, nil, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown state = %d, want 400", rec.Code)
	}
}
