package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/bash"
	"github.com/sid0709/OpenSeat/backend-core/bashapi"
	"github.com/sid0709/OpenSeat/backend-core/bashapi/gateway"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

func named(name string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(name)) })
}

func TestRoutesSendEachPrefixToItsHandler(t *testing.T) {
	handler := routes([]string{"http://localhost:5173"}, named("health"), named("bash"))
	cases := []struct{ method, path, want string }{
		{"GET", "/health", "health"},
		{"GET", "/bash/health", "bash"},
		{"POST", "/bash/ai-analyze", "bash"},
		{"GET", gateway.Path + "/?EIO=4&transport=polling", "bash"},
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

func TestSocketPathIsInsideTheBashPrefix(t *testing.T) {
	if !strings.HasPrefix(gateway.Path, bashapi.Prefix+"/") {
		t.Fatalf("gateway.Path %q is outside %q, so the server would not route it to Bash", gateway.Path, bashapi.Prefix)
	}
}

func TestRoutesAllowListedOrigins(t *testing.T) {
	handler := routes([]string{"http://localhost:5173"}, named("health"), named("bash"))
	req := httptest.NewRequest("OPTIONS", "/bash/qa", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("preflight = %d, allow-origin %q", rec.Code, rec.Header().Get("Access-Control-Allow-Origin"))
	}
}

type noSessions struct{}

func (noSessions) Session(context.Context, string, time.Time) (auth.Session, error) {
	return auth.Session{}, auth.ErrInvalidLogin
}

type noPeople struct{}

func (noPeople) GetProfile(context.Context, string, time.Time) (candidate.Profile, error) {
	return candidate.Profile{}, nil
}
func (noPeople) SavedJobIDs(context.Context, string) ([]string, error)   { return nil, nil }
func (noPeople) AppliedJobIDs(context.Context, string) ([]string, error) { return nil, nil }
func (noPeople) Apply(context.Context, string, candidate.ApplyInput, time.Time) (candidate.Application, error) {
	return candidate.Application{}, nil
}

// The real Bash handler behind the real router: the extension's Engine.IO handshake
// at gateway.Path and its plain routes both reach Bash.
func TestBashAnswersThroughTheServer(t *testing.T) {
	bashHandler, gw := bashapi.New(noSessions{}, noPeople{}, nil, bash.New(nil), bashapi.Options{})
	t.Cleanup(gw.Close)
	handler := routes(nil, named("health"), bashHandler)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", gateway.Path+"/?EIO=4&transport=polling", nil))
	if rec.Code != http.StatusOK || !strings.HasPrefix(rec.Body.String(), "0{") || !strings.Contains(rec.Body.String(), `"sid":`) {
		t.Fatalf("handshake = %d %q", rec.Code, rec.Body.String())
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", bashapi.Prefix+"/auth/me", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed-out /bash/auth/me = %d, want 401", rec.Code)
	}
}
