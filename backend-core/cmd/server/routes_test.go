package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/bashapi"
	"github.com/sid0709/OpenSeat/backend-core/bashapi/gateway"
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
