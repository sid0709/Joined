package main

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/acorn-backend/account"
	"github.com/sid0709/OpenSeat/acorn-backend/acorn"
	"github.com/sid0709/OpenSeat/acorn-backend/acornapi"
	"github.com/sid0709/OpenSeat/acorn-backend/acornapi/gateway"
)

func named(name string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(name)) })
}

func TestRoutesSendEachPrefixToItsHandler(t *testing.T) {
	logger := slog.Default()
	handler := routes([]string{"http://localhost:5173"}, named("health"), named("acorn"), logger, nil)
	cases := []struct{ method, path, want string }{
		{"GET", "/health", "health"},
		{"GET", "/acorn/health", "acorn"},
		{"POST", "/acorn/ai-analyze", "acorn"},
		{"GET", gateway.Path + "/?EIO=4&transport=polling", "acorn"},
		{"POST", acornapi.GooglePrefix + "/start", "acorn"},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(c.method, c.path, nil))
		if got := rec.Body.String(); got != c.want {
			t.Errorf("%s %s went to %q, want %q", c.method, c.path, got, c.want)
		}
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", "/elsewhere/health", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("an unknown prefix = %d, want 404", rec.Code)
	}
}

func TestAcornDatabaseIsSeparateFromJoined(t *testing.T) {
	if defaultDatabase != "AcornDB" {
		t.Fatalf("Acorn database = %q, want AcornDB", defaultDatabase)
	}
}

func TestSocketPathIsInsideTheAcornPrefix(t *testing.T) {
	if !strings.HasPrefix(gateway.Path, acornapi.Prefix+"/") {
		t.Fatalf("gateway.Path %q is outside %q, so the server would not route it to Acorn", gateway.Path, acornapi.Prefix)
	}
}

func TestRoutesAllowListedOrigins(t *testing.T) {
	logger := slog.Default()
	handler := routes([]string{"http://localhost:5173"}, named("health"), named("acorn"), logger, nil)
	req := httptest.NewRequest("OPTIONS", "/acorn/qa", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("preflight = %d, allow-origin %q", rec.Code, rec.Header().Get("Access-Control-Allow-Origin"))
	}
}

type noAccounts struct{}

func (noAccounts) Session(context.Context, string, time.Time) (account.Session, error) {
	return account.Session{}, account.ErrInvalidLogin
}
func (noAccounts) SignUp(context.Context, string, string, string, time.Time) (string, account.User, error) {
	return "", account.User{}, account.ErrInvalidLogin
}
func (noAccounts) SignIn(context.Context, string, string, time.Time) (string, account.User, error) {
	return "", account.User{}, account.ErrInvalidLogin
}
func (noAccounts) Revoke(context.Context, string) error { return nil }
func (noAccounts) SavedJobIDs(context.Context, string) ([]string, error) {
	return nil, nil
}
func (noAccounts) AppliedJobIDs(context.Context, string) ([]string, error) {
	return nil, nil
}
func (noAccounts) MarkApplied(context.Context, string, string) error { return nil }
func (noAccounts) SaveGoogleState(context.Context, string, string, time.Time) error {
	return nil
}
func (noAccounts) TakeGoogleState(context.Context, string, time.Time) (string, error) {
	return "", account.ErrGoogleState
}
func (noAccounts) GoogleSignIn(context.Context, account.GoogleIdentity, time.Time) (string, account.User, error) {
	return "", account.User{}, account.ErrInvalidLogin
}

// The real Acorn handler behind the real router: the extension's Engine.IO handshake
// at gateway.Path and its plain routes both reach Acorn.
func TestAcornAnswersThroughTheServer(t *testing.T) {
	logger := slog.Default()
	acornHandler, gw := acornapi.New(noAccounts{}, nil, acorn.New(nil), acornapi.Options{})
	t.Cleanup(gw.Close)
	handler := routes(nil, named("health"), acornHandler, logger, nil)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", gateway.Path+"/?EIO=4&transport=polling", nil))
	if rec.Code != http.StatusOK || !strings.HasPrefix(rec.Body.String(), "0{") || !strings.Contains(rec.Body.String(), `"sid":`) {
		t.Fatalf("handshake = %d %q", rec.Code, rec.Body.String())
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", acornapi.Prefix+"/auth/me", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed-out /acorn/auth/me = %d, want 401", rec.Code)
	}
}
