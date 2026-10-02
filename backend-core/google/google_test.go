package google

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

// fakeGoogle answers requests the way Google's endpoints do.
type fakeGoogle func(req *http.Request) (int, string)

func (f fakeGoogle) RoundTrip(req *http.Request) (*http.Response, error) {
	status, body := f(req)
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
}

func client(f fakeGoogle) *Client {
	return &Client{ClientID: "id", ClientSecret: "secret", HTTP: &http.Client{Transport: f}}
}

func TestAuthURLCarriesTheRequest(t *testing.T) {
	c := &Client{ClientID: "id", ClientSecret: "secret"}
	raw := c.AuthURL(AuthRequest{
		RedirectURL:   "http://localhost:3002/api/auth/google/callback",
		Scopes:        []string{ScopeOpenID, ScopeEmail, ScopeCalendarEvents},
		State:         "state-1",
		CodeChallenge: "challenge",
		Offline:       true,
	})
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	want := map[string]string{
		"client_id":             "id",
		"redirect_uri":          "http://localhost:3002/api/auth/google/callback",
		"response_type":         "code",
		"scope":                 "openid email " + ScopeCalendarEvents,
		"state":                 "state-1",
		"code_challenge":        "challenge",
		"code_challenge_method": "S256",
		"access_type":           "offline",
	}
	for key, value := range want {
		if got := query.Get(key); got != value {
			t.Errorf("%s = %q, want %q", key, got, value)
		}
	}
	if query.Has("hd") {
		t.Errorf("hd = %q, want none unless HostedDomain is set", query.Get("hd"))
	}
	if hd := (&Client{}).AuthURL(AuthRequest{HostedDomain: "joinedhq.com"}); !strings.Contains(hd, "hd=joinedhq.com") {
		t.Errorf("hosted domain URL = %q", hd)
	}
	if query.Has("prompt") {
		t.Errorf("prompt = %q, want none unless Consent is set", query.Get("prompt"))
	}

	plain, _ := url.Parse(c.AuthURL(AuthRequest{Scopes: []string{ScopeOpenID}, Consent: true}))
	if plain.Query().Has("access_type") || plain.Query().Has("code_challenge") || plain.Query().Get("prompt") != "consent" {
		t.Errorf("plain request = %s", plain.RawQuery)
	}
}

func TestExchangeSendsTheVerifierAndReadsScopes(t *testing.T) {
	var form url.Values
	c := client(func(req *http.Request) (int, string) {
		body, _ := io.ReadAll(req.Body)
		form, _ = url.ParseQuery(string(body))
		return http.StatusOK, `{"access_token":"at","refresh_token":"rt","scope":"openid email ` + ScopeCalendarEvents + `"}`
	})
	token, err := c.Exchange(context.Background(), "code-1", "http://localhost/cb", "verifier-1")
	if err != nil {
		t.Fatal(err)
	}
	if form.Get("code") != "code-1" || form.Get("code_verifier") != "verifier-1" || form.Get("redirect_uri") != "http://localhost/cb" || form.Get("grant_type") != "authorization_code" {
		t.Fatalf("form = %v", form)
	}
	if token.AccessToken != "at" || token.RefreshToken != "rt" {
		t.Fatalf("token = %+v", token)
	}
	if !token.Granted(ScopeCalendarEvents) || token.Granted(ScopeProfile) {
		t.Fatalf("scopes = %q", token.Scope)
	}
}

func TestExchangeMapsInvalidGrant(t *testing.T) {
	c := client(func(*http.Request) (int, string) {
		return http.StatusBadRequest, `{"error":"invalid_grant"}`
	})
	if _, err := c.Exchange(context.Background(), "used", "http://localhost/cb", ""); !errors.Is(err, ErrInvalidGrant) {
		t.Fatalf("err = %v, want ErrInvalidGrant", err)
	}
	failing := client(func(*http.Request) (int, string) { return http.StatusInternalServerError, `{}` })
	if _, err := failing.AccessToken(context.Background(), "rt"); err == nil || errors.Is(err, ErrInvalidGrant) {
		t.Fatalf("err = %v, want a plain failure", err)
	}
}

func TestProfileNormalizesTheAccount(t *testing.T) {
	c := client(func(req *http.Request) (int, string) {
		if req.Header.Get("Authorization") != "Bearer at" {
			return http.StatusUnauthorized, `{}`
		}
		return http.StatusOK, `{"sub":"123","email":" Ada@Example.com ","email_verified":true,"name":" Ada Lovelace "}`
	})
	profile, err := c.Profile(context.Background(), "at")
	if err != nil {
		t.Fatal(err)
	}
	want := Profile{Subject: "123", Email: "ada@example.com", EmailVerified: true, Name: "Ada Lovelace"}
	if profile != want {
		t.Fatalf("profile = %+v, want %+v", profile, want)
	}
	if _, err := c.Profile(context.Background(), "wrong"); err == nil {
		t.Fatal("expected an error for a rejected token")
	}
}

func TestVerifierMatchesItsChallenge(t *testing.T) {
	verifier, challenge, err := NewVerifier()
	if err != nil {
		t.Fatal(err)
	}
	if len(verifier) < 43 || len(verifier) > 128 {
		t.Fatalf("verifier length = %d", len(verifier))
	}
	sum := sha256.Sum256([]byte(verifier))
	if challenge != base64.RawURLEncoding.EncodeToString(sum[:]) {
		t.Fatal("challenge is not the S256 of the verifier")
	}
	a, _ := NewState()
	b, _ := NewState()
	if a == "" || a == b {
		t.Fatalf("states = %q %q", a, b)
	}
}

func TestConfigured(t *testing.T) {
	var none *Client
	if none.Configured() || (&Client{ClientID: "id"}).Configured() || !(&Client{ClientID: "id", ClientSecret: "s"}).Configured() {
		t.Fatal("Configured needs both the client id and secret")
	}
}
