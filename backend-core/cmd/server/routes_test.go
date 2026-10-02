package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/acorn"
	"github.com/sid0709/OpenSeat/backend-core/acornapi"
	"github.com/sid0709/OpenSeat/backend-core/acornapi/gateway"
	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

func named(name string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(name)) })
}

func TestRoutesSendEachPrefixToItsHandler(t *testing.T) {
	handler := routes([]string{"http://localhost:5173"}, named("health"), named("acorn"))
	cases := []struct{ method, path, want string }{
		{"GET", "/health", "health"},
		{"GET", "/acorn/health", "acorn"},
		{"POST", "/acorn/ai-analyze", "acorn"},
		{"GET", gateway.Path + "/?EIO=4&transport=polling", "acorn"},
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

func TestSocketPathIsInsideTheAcornPrefix(t *testing.T) {
	if !strings.HasPrefix(gateway.Path, acornapi.Prefix+"/") {
		t.Fatalf("gateway.Path %q is outside %q, so the server would not route it to Acorn", gateway.Path, acornapi.Prefix)
	}
}

func TestRoutesAllowListedOrigins(t *testing.T) {
	handler := routes([]string{"http://localhost:5173"}, named("health"), named("acorn"))
	req := httptest.NewRequest("OPTIONS", "/acorn/qa", nil)
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

// The real Acorn handler behind the real router: the extension's Engine.IO handshake
// at gateway.Path and its plain routes both reach Acorn.
func TestAcornAnswersThroughTheServer(t *testing.T) {
	acornHandler, gw := acornapi.New(noSessions{}, noPeople{}, nil, acorn.New(nil), acornapi.Options{})
	t.Cleanup(gw.Close)
	handler := routes(nil, named("health"), acornHandler)

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
