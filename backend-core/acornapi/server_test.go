package bashapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/bash"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

type fakeSessions map[string]auth.Session

func (f fakeSessions) Session(_ context.Context, token string, _ time.Time) (auth.Session, error) {
	if session, ok := f[token]; ok {
		return session, nil
	}
	return auth.Session{}, auth.ErrInvalidLogin
}

type fakePeople struct{ applied []string }

func (f *fakePeople) GetProfile(context.Context, string, time.Time) (candidate.Profile, error) {
	return candidate.Profile{Name: "Jordan Lee", Email: "j@example.com"}, nil
}
func (f *fakePeople) SavedJobIDs(context.Context, string) ([]string, error) { return nil, nil }
func (f *fakePeople) AppliedJobIDs(context.Context, string) ([]string, error) {
	return nil, nil
}
func (f *fakePeople) Apply(_ context.Context, _ string, input candidate.ApplyInput, _ time.Time) (candidate.Application, error) {
	if input.JobID == "dup" {
		return candidate.Application{}, candidate.ErrAlreadyApplied
	}
	f.applied = append(f.applied, input.JobID+":"+input.Stage)
	return candidate.Application{}, nil
}

type fakeModel struct{ reply string }

func (f fakeModel) JSON(context.Context, string, string, json.RawMessage) ([]byte, error) {
	return []byte(f.reply), nil
}
func (fakeModel) Model() string { return "fake" }
func (fakeModel) Ready() bool   { return true }

func newTestServer(t *testing.T, model fakeModel) (http.Handler, *fakePeople) {
	t.Helper()
	people := &fakePeople{}
	sessions := fakeSessions{
		"hunter":    {User: auth.User{ID: "u1", Name: "Jordan Lee", Email: "j@example.com", Role: auth.RoleCandidate}},
		"recruiter": {User: auth.User{ID: "u2", Role: auth.RoleEmployee}},
	}
	handler, gw := New(sessions, people, nil, bash.New(model), Options{})
	t.Cleanup(gw.Close)
	return handler, people
}

func call(handler http.Handler, method, path, body string, header http.Header, cookie string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for key, values := range header {
		req.Header[key] = values
	}
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: DefaultSessionCookie, Value: cookie})
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func bearer(token string) http.Header { return http.Header{"Authorization": {"Bearer " + token}} }

func TestSessionFromBearerOrJoinedCookie(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	cases := []struct {
		name   string
		header http.Header
		cookie string
		want   int
	}{
		{"bearer", bearer("hunter"), "", http.StatusOK},
		{"joined cookie", nil, "hunter", http.StatusOK},
		{"bearer wins over a stale cookie", bearer("hunter"), "stale", http.StatusOK},
		{"no credentials", nil, "", http.StatusUnauthorized},
		{"unknown token", bearer("nope"), "", http.StatusUnauthorized},
		{"recruiter is not a job hunter", bearer("recruiter"), "", http.StatusForbidden},
	}
	for _, c := range cases {
		if got := call(handler, "GET", "/bash/auth/me", "", c.header, c.cookie).Code; got != c.want {
			t.Errorf("%s: status %d, want %d", c.name, got, c.want)
		}
	}
}

func TestMeReturnsJoinedAccount(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	var body struct {
		Session map[string]string `json:"session"`
	}
	rec := call(handler, "GET", "/bash/auth/me", "", bearer("hunter"), "")
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Session["accountId"] != "u1" || body.Session["applierName"] != "Jordan Lee" || body.Session["username"] != "j@example.com" {
		t.Fatalf("session = %v", body.Session)
	}
}

func TestHealthNeedsNoSession(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	rec := call(handler, "GET", "/bash/health", "", nil, "")
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"ok":true}` {
		t.Fatalf("health = %d %s", rec.Code, rec.Body)
	}
}

func TestResumeRoutesReturnEmpty(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	cases := []struct{ method, path, wantKey string }{
		{"GET", "/bash/jobs/j1/recommended-resume", "success"},
		{"GET", "/bash/jobs/j1/resume-preview", "html"},
		{"POST", "/bash/custom/generate", "inputId"},
		{"POST", "/bash/custom/recommend", "recommendedResumeId"},
		{"GET", "/bash/custom/resumes/g1", "success"},
		{"GET", "/bash/custom/library-resumes/r1", "success"},
	}
	for _, c := range cases {
		rec := call(handler, c.method, c.path, "{}", bearer("hunter"), "")
		if rec.Code != http.StatusOK && rec.Code != http.StatusAccepted {
			t.Errorf("%s %s: status %d", c.method, c.path, rec.Code)
		}
		var body map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s: %v", c.path, err)
		}
		if _, ok := body[c.wantKey]; !ok || body["file"] != nil {
			t.Errorf("%s: body = %v", c.path, body)
		}
		if unauth := call(handler, c.method, c.path, "{}", nil, ""); unauth.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without session: %d", c.method, c.path, unauth.Code)
		}
	}
}

func TestAnalyzeUsesProfileAndNeverReturnsResumeGate(t *testing.T) {
	plan := `{"goal":"g","actions":[],"forbidden_actions":[],"validation":{"required_element_indexes":[],"stop_before_submit":true},"unresolved_items":[]}`
	handler, _ := newTestServer(t, fakeModel{reply: plan})
	rec := call(handler, "POST", "/bash/ai-analyze", `{"pureTree":"input[1]","page":{"url":"https://x"}}`, bearer("hunter"), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), `"ok":true`) {
		t.Fatalf("body = %s", rec.Body)
	}
	if got := call(handler, "POST", "/bash/ai-analyze", `{"pureTree":""}`, bearer("hunter"), "").Code; got != http.StatusBadRequest {
		t.Errorf("empty tree status %d, want 400", got)
	}
}

func TestMatchOptionFailureIsData(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{reply: "not json"})
	rec := call(handler, "POST", "/bash/match-option", `{"intendedValue":"No","options":["Yes","No"]}`, bearer("hunter"), "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"ok":false`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	if got := call(handler, "POST", "/bash/match-option", `{"intendedValue":"","options":[]}`, bearer("hunter"), "").Code; got != http.StatusBadRequest {
		t.Errorf("missing fields status %d, want 400", got)
	}
}

func TestMarkApplied(t *testing.T) {
	handler, people := newTestServer(t, fakeModel{})
	if rec := call(handler, "POST", "/bash/jobs/j1/mark-applied", "", bearer("hunter"), ""); rec.Code != http.StatusOK {
		t.Fatalf("mark applied: %d %s", rec.Code, rec.Body)
	}
	if len(people.applied) != 1 || people.applied[0] != "j1:"+candidate.StageApplied {
		t.Fatalf("applied = %v", people.applied)
	}
	if rec := call(handler, "POST", "/bash/jobs/dup/mark-applied", "", bearer("hunter"), ""); rec.Code != http.StatusOK {
		t.Fatalf("already applied should still succeed: %d", rec.Code)
	}
}

func TestSignOutKeepsJoinedSession(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	if rec := call(handler, "POST", "/bash/auth/signout", "", bearer("hunter"), ""); rec.Code != http.StatusOK {
		t.Fatalf("signout: %d", rec.Code)
	}
	if rec := call(handler, "GET", "/bash/auth/me", "", bearer("hunter"), ""); rec.Code != http.StatusOK {
		t.Fatalf("the shared Joined session must survive a Bash sign-out: %d", rec.Code)
	}
}
