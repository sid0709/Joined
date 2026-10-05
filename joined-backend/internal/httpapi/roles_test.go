package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

type fakeSessions struct {
	sessions map[string]auth.Session
}

func (f *fakeSessions) Session(_ context.Context, token string, _ time.Time) (auth.Session, error) {
	if session, ok := f.sessions[token]; ok {
		return session, nil
	}
	return auth.Session{}, auth.ErrInvalidLogin
}

func testSessions() *fakeSessions {
	return &fakeSessions{
		sessions: map[string]auth.Session{
			"candidate-token": {
				User: auth.User{ID: "c1", Role: auth.RoleCandidate, Email: "c@example.com"},
			},
			"employee-token": {
				User:    auth.User{ID: "e1", Role: auth.RoleEmployee, Email: "e@example.com"},
				Company: &auth.Company{ID: "co1", Name: "Acme", Role: "owner"},
			},
			"scout-token": {
				User: auth.User{ID: "s1", Role: auth.RoleScout, Email: "s@example.com"},
			},
		},
	}
}

func TestJoinedRouteGroupsRejectWrongRole(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, Options{
		CompanyMode: true,
		Sessions:    testSessions(),
	})
	groups := []struct {
		name  string
		path  string
		allow string
	}{
		{name: "candidate /v1/me", path: "/v1/me/profile", allow: "candidate-token"},
		{name: "employee /v1/company", path: "/v1/company/overview", allow: "employee-token"},
	}
	tokens := []struct {
		name  string
		token string
	}{
		{name: "signed out", token: ""},
		{name: "candidate", token: "candidate-token"},
		{name: "employee", token: "employee-token"},
		{name: "scout", token: "scout-token"},
	}

	for _, group := range groups {
		for _, token := range tokens {
			t.Run(group.name+" "+token.name, func(t *testing.T) {
				req := httptest.NewRequest(http.MethodGet, group.path, nil)
				if token.token != "" {
					req.Header.Set("Authorization", "Bearer "+token.token)
				}
				rec := httptest.NewRecorder()
				handler.ServeHTTP(rec, req)

				switch {
				case token.token == "":
					if rec.Code != http.StatusUnauthorized {
						t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
					}
					assertError(t, rec, "sign in required")
				case token.token == group.allow:
					if rec.Code == http.StatusUnauthorized || rec.Code == http.StatusForbidden || rec.Code == http.StatusNotFound {
						t.Fatalf("allowed role blocked: %d %s", rec.Code, rec.Body.String())
					}
				default:
					if rec.Code != http.StatusForbidden {
						t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
					}
				}
			})
		}
	}
}

func TestCompanyModeOffStill401WhenSignedOut(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, Options{CompanyMode: false})
	req := httptest.NewRequest(http.MethodGet, "/v1/company/overview", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestCompanyModeOffForbidsEmployee(t *testing.T) {
	sessions := testSessions()
	off := New(nil, nil, nil, nil, nil, nil, Options{CompanyMode: false, Sessions: sessions})
	on := New(nil, nil, nil, nil, nil, nil, Options{CompanyMode: true, Sessions: sessions})

	req := httptest.NewRequest(http.MethodGet, "/v1/company/overview", nil)
	req.Header.Set("Authorization", "Bearer employee-token")

	offRec := httptest.NewRecorder()
	off.ServeHTTP(offRec, req)
	if offRec.Code != http.StatusForbidden {
		t.Fatalf("company mode off: status = %d body = %s", offRec.Code, offRec.Body.String())
	}
	assertError(t, offRec, companyModeDisabledMessage)

	onRec := httptest.NewRecorder()
	on.ServeHTTP(onRec, req.Clone(req.Context()))
	if onRec.Code == http.StatusForbidden && strings.Contains(onRec.Body.String(), companyModeDisabledMessage) {
		t.Fatalf("company mode on still rejected the employee: %s", onRec.Body.String())
	}
	if onRec.Code == http.StatusUnauthorized || onRec.Code == http.StatusNotFound {
		t.Fatalf("company mode on: status = %d body = %s", onRec.Code, onRec.Body.String())
	}
}

func assertError(t *testing.T, rec *httptest.ResponseRecorder, want string) {
	t.Helper()
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v body = %s", err, rec.Body.String())
	}
	if body["error"] != want {
		t.Fatalf("error = %q want %q", body["error"], want)
	}
}
