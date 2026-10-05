package acornapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/acorn-backend/account"
	"github.com/sid0709/OpenSeat/acorn-backend/acorn"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

type fakeAccounts struct {
	users          map[string]account.User
	applied        []string
	googleState    string
	googleVerifier string
	googleErr      error
}

func (f *fakeAccounts) Session(_ context.Context, token string, _ time.Time) (account.Session, error) {
	if user, ok := f.users[token]; ok {
		return account.Session{User: user}, nil
	}
	return account.Session{}, account.ErrInvalidLogin
}

func (f *fakeAccounts) SignUp(context.Context, string, string, string, time.Time) (string, account.User, error) {
	return "", account.User{}, account.ErrInvalid
}
func (f *fakeAccounts) SignIn(_ context.Context, email, password string, _ time.Time) (string, account.User, error) {
	if email == "j@example.com" && password == "password1" {
		user := f.users["hunter"]
		return "hunter", user, nil
	}
	return "", account.User{}, account.ErrInvalidLogin
}
func (f *fakeAccounts) Revoke(_ context.Context, token string) error {
	delete(f.users, token)
	return nil
}
func (f *fakeAccounts) SavedJobIDs(context.Context, string) ([]string, error) { return nil, nil }
func (f *fakeAccounts) AppliedJobIDs(context.Context, string) ([]string, error) {
	return nil, nil
}
func (f *fakeAccounts) MarkApplied(_ context.Context, _ string, jobID string) error {
	if jobID == "dup" {
		return account.ErrAlreadyApplied
	}
	f.applied = append(f.applied, jobID)
	return nil
}
func (f *fakeAccounts) SaveGoogleState(_ context.Context, state, verifier string, _ time.Time) error {
	f.googleState = state
	f.googleVerifier = verifier
	return nil
}
func (f *fakeAccounts) TakeGoogleState(_ context.Context, state string, _ time.Time) (string, error) {
	if state == "" || state != f.googleState {
		return "", account.ErrGoogleState
	}
	verifier := f.googleVerifier
	f.googleState = ""
	return verifier, nil
}
func (f *fakeAccounts) GoogleSignIn(context.Context, account.GoogleIdentity, time.Time) (string, account.User, error) {
	if f.googleErr != nil {
		return "", account.User{}, f.googleErr
	}
	return "hunter", account.User{ID: "u1", Name: "Jordan Lee", Email: "j@example.com"}, nil
}

type fakeModel struct{ reply string }

func (f fakeModel) JSON(context.Context, string, string, json.RawMessage) ([]byte, error) {
	return []byte(f.reply), nil
}
func (fakeModel) Model() string { return "fake" }
func (fakeModel) Ready() bool   { return true }

func newTestServer(t *testing.T, model fakeModel) (http.Handler, *fakeAccounts) {
	t.Helper()
	accounts := &fakeAccounts{users: map[string]account.User{
		"hunter": {ID: "u1", Name: "Jordan Lee", Email: "j@example.com"},
	}}
	handler, gw := New(accounts, nil, acorn.New(model), Options{})
	t.Cleanup(gw.Close)
	return handler, accounts
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

func TestSessionFromBearerOrAcornCookie(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	cases := []struct {
		name   string
		header http.Header
		cookie string
		want   int
	}{
		{"bearer", bearer("hunter"), "", http.StatusOK},
		{"acorn cookie", nil, "hunter", http.StatusOK},
		{"bearer wins over a stale cookie", bearer("hunter"), "stale", http.StatusOK},
		{"no credentials", nil, "", http.StatusUnauthorized},
		{"unknown token", bearer("nope"), "", http.StatusUnauthorized},
	}
	for _, c := range cases {
		if got := call(handler, "GET", "/acorn/auth/me", "", c.header, c.cookie).Code; got != c.want {
			t.Errorf("%s: status %d, want %d", c.name, got, c.want)
		}
	}
}

func TestMeReturnsAcornAccount(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	var body struct {
		Session map[string]string `json:"session"`
	}
	rec := call(handler, "GET", "/acorn/auth/me", "", bearer("hunter"), "")
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Session["accountId"] != "u1" || body.Session["applierName"] != "Jordan Lee" || body.Session["username"] != "j@example.com" {
		t.Fatalf("session = %v", body.Session)
	}
}

func TestHealthNeedsNoSession(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	rec := call(handler, "GET", "/acorn/health", "", nil, "")
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"ok":true}` {
		t.Fatalf("health = %d %s", rec.Code, rec.Body)
	}
}

func TestResumeRoutesReturnEmpty(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	cases := []struct{ method, path, wantKey string }{
		{"GET", "/acorn/jobs/j1/recommended-resume", "success"},
		{"GET", "/acorn/jobs/j1/resume-preview", "html"},
		{"POST", "/acorn/custom/generate", "inputId"},
		{"POST", "/acorn/custom/recommend", "recommendedResumeId"},
		{"GET", "/acorn/custom/resumes/g1", "success"},
		{"GET", "/acorn/custom/library-resumes/r1", "success"},
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
	rec := call(handler, "POST", "/acorn/ai-analyze", `{"pureTree":"input[1]","page":{"url":"https://x"}}`, bearer("hunter"), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), `"ok":true`) {
		t.Fatalf("body = %s", rec.Body)
	}
	if got := call(handler, "POST", "/acorn/ai-analyze", `{"pureTree":""}`, bearer("hunter"), "").Code; got != http.StatusBadRequest {
		t.Errorf("empty tree status %d, want 400", got)
	}
}

func TestMatchOptionFailureIsData(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{reply: "not json"})
	rec := call(handler, "POST", "/acorn/match-option", `{"intendedValue":"No","options":["Yes","No"]}`, bearer("hunter"), "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"ok":false`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	if got := call(handler, "POST", "/acorn/match-option", `{"intendedValue":"","options":[]}`, bearer("hunter"), "").Code; got != http.StatusBadRequest {
		t.Errorf("missing fields status %d, want 400", got)
	}
}

func TestSignInReturnsTheAccount(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	rec := call(handler, "POST", "/acorn/auth/signin", `{"email":"j@example.com","password":"password1"}`, nil, "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"token":"hunter"`) {
		t.Fatalf("signin = %d %s", rec.Code, rec.Body)
	}
	if rec := call(handler, "POST", "/acorn/auth/signin", `{"email":"j@example.com","password":"nope"}`, nil, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("bad password = %d", rec.Code)
	}
}

func TestMarkApplied(t *testing.T) {
	handler, accounts := newTestServer(t, fakeModel{})
	if rec := call(handler, "POST", "/acorn/jobs/j1/mark-applied", "", bearer("hunter"), ""); rec.Code != http.StatusOK {
		t.Fatalf("mark applied: %d %s", rec.Code, rec.Body)
	}
	if len(accounts.applied) != 1 || accounts.applied[0] != "j1" {
		t.Fatalf("applied = %v", accounts.applied)
	}
	if rec := call(handler, "POST", "/acorn/jobs/dup/mark-applied", "", bearer("hunter"), ""); rec.Code != http.StatusOK {
		t.Fatalf("already applied should still succeed: %d", rec.Code)
	}
}

func TestAcornAIKillSwitch(t *testing.T) {
	accounts := &fakeAccounts{users: map[string]account.User{
		"hunter": {ID: "u1", Name: "Jordan Lee", Email: "j@example.com"},
	}}
	handler, gw := New(accounts, nil, acorn.New(fakeModel{reply: `{"goal":"g"}`}), Options{
		KillSwitches: killswitch.NewMemory(killswitch.Defaults{killswitch.AcornAI: false}),
	})
	t.Cleanup(gw.Close)
	rec := call(handler, "POST", "/acorn/ai-analyze", `{"pureTree":"input[1]"}`, bearer("hunter"), "")
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "Acorn AI") {
		t.Fatalf("killed AI = %d %s", rec.Code, rec.Body.String())
	}
	if rec := call(handler, "GET", "/acorn/auth/me", "", bearer("hunter"), ""); rec.Code != http.StatusOK {
		t.Fatalf("auth should stay up: %d", rec.Code)
	}
}

func TestSignOutRevokesTheAcornSession(t *testing.T) {
	handler, _ := newTestServer(t, fakeModel{})
	if rec := call(handler, "POST", "/acorn/auth/signout", "", bearer("hunter"), ""); rec.Code != http.StatusOK {
		t.Fatalf("signout: %d", rec.Code)
	}
	if rec := call(handler, "GET", "/acorn/auth/me", "", bearer("hunter"), ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed-out session = %d, want 401", rec.Code)
	}
}
