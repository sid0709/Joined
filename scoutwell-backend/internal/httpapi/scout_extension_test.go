package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/scout"
)

const (
	testScoutID     = "scout-1"
	testHunterID    = "hunter-1"
	testSession     = "session-good"
	testBadSession  = "session-bad"
	testHunterSess  = "session-hunter"
	testIdempotency = "ext-key-1"
	allowedOrigin   = "chrome-extension://allowed-id"
	blockedOrigin   = "https://evil.example"
	extensionPath   = "/v1/scout/submissions/extension"
)

const testDescription = "This captured job description is long enough to pass the minimum summary length for a scout submission."

type fakeSessions struct {
	tokens map[string]string
}

func (f *fakeSessions) SessionUserID(_ context.Context, token string, _ time.Time) (string, error) {
	if userID, ok := f.tokens[token]; ok {
		return userID, nil
	}
	return "", auth.ErrInvalidLogin
}

func testExtensionHandler(t *testing.T) (http.Handler, *scout.Store) {
	t.Helper()
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	accounts := &scout.MemoryAccounts{UsersByID: map[string]auth.User{
		testScoutID:  {ID: testScoutID, Name: "Ada Scout", Email: "ada@example.com", Role: auth.RoleScout},
		testHunterID: {ID: testHunterID, Name: "Pat Hunter", Email: "pat@example.com", Role: auth.RoleCandidate},
	}}
	store := scout.NewMemoryStore(accounts, func() time.Time { return now })
	scout.MemoryAcceptTerms(store, testScoutID)
	sessions := &fakeSessions{tokens: map[string]string{
		testSession:    testScoutID,
		testHunterSess: testHunterID,
	}}
	handler := newHandler(nil, nil, sessions, store, Options{
		Origins:          []string{"https://scoutwell.example"},
		ExtensionOrigins: []string{allowedOrigin},
	})
	return handler, store
}

func extensionBody(t *testing.T, overrides map[string]string) []byte {
	t.Helper()
	payload := map[string]string{
		"title":       "Staff Engineer",
		"company":     "Acme Labs",
		"location":    "Remote",
		"apply_url":   "https://boards.greenhouse.io/acme/jobs/123",
		"description": testDescription,
		"board":       "Greenhouse",
	}
	for key, value := range overrides {
		if value == "" {
			delete(payload, key)
		} else {
			payload[key] = value
		}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func extensionRequest(method, origin, token string, cookie bool, key string, body []byte) *http.Request {
	req := httptest.NewRequest(method, extensionPath, bytes.NewReader(body))
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	if token != "" {
		if cookie {
			req.AddCookie(&http.Cookie{Name: SessionCookie, Value: token})
		} else {
			req.Header.Set("Authorization", "Bearer "+token)
		}
	}
	if key != "" {
		req.Header.Set(httpkit.IdempotencyHeader, key)
	}
	if method != http.MethodOptions {
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}

func doExtension(t *testing.T, handler http.Handler, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestExtensionSubmitValidationMissingField(t *testing.T) {
	handler, store := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, testIdempotency, extensionBody(t, map[string]string{"title": ""})))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422, body = %s", rec.Code, rec.Body.String())
	}
	if scout.MemorySubmissionCount(store) != 0 {
		t.Fatalf("count = %d, want 0", scout.MemorySubmissionCount(store))
	}
}

func TestExtensionSubmitValidationBadURL(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, testIdempotency, extensionBody(t, map[string]string{"apply_url": "ftp://acme.com/job"})))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422, body = %s", rec.Code, rec.Body.String())
	}
}

func TestExtensionSubmitValidationOversizeField(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, testIdempotency, extensionBody(t, map[string]string{"title": strings.Repeat("t", 200)})))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422, body = %s", rec.Code, rec.Body.String())
	}
}

func TestExtensionSubmitValidationOversizeBody(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	body := []byte(`{"title":"x","company":"y","location":"z","apply_url":"https://acme.com/jobs/1","description":"` + strings.Repeat("d", maxExtensionBody) + `"}`)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, testIdempotency, body))
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413, body = %s", rec.Code, rec.Body.String())
	}
}

func TestExtensionSubmitRequiresIdempotencyKey(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, "", extensionBody(t, nil)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body = %s", rec.Code, rec.Body.String())
	}
}

func TestExtensionSubmitRejectsMalformedIdempotencyKey(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, strings.Repeat("k", 256), extensionBody(t, nil)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body = %s", rec.Code, rec.Body.String())
	}
}

func TestExtensionSubmitIdempotentReplay(t *testing.T) {
	handler, store := testExtensionHandler(t)
	body := extensionBody(t, nil)
	first := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, testIdempotency, body))
	if first.Code != http.StatusCreated {
		t.Fatalf("first status = %d, body = %s", first.Code, first.Body.String())
	}
	second := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, testIdempotency, body))
	if second.Code != http.StatusCreated {
		t.Fatalf("second status = %d, body = %s", second.Code, second.Body.String())
	}
	if second.Header().Get("Idempotent-Replayed") != "true" {
		t.Fatal("expected Idempotent-Replayed on replay")
	}
	if first.Body.String() != second.Body.String() {
		t.Fatalf("replay body mismatch:\n%s\n%s", first.Body.String(), second.Body.String())
	}
	if scout.MemorySubmissionCount(store) != 1 {
		t.Fatalf("count = %d, want 1", scout.MemorySubmissionCount(store))
	}
	var payload struct {
		Submission scout.Submission `json:"submission"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Submission.ID == "" || payload.Submission.Title != "Staff Engineer" {
		t.Fatalf("response = %+v", payload.Submission)
	}
}

func TestExtensionSubmitIdempotentKeyReuseDifferentBody(t *testing.T) {
	handler, store := testExtensionHandler(t)
	first := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, testIdempotency, extensionBody(t, nil)))
	if first.Code != http.StatusCreated {
		t.Fatalf("first status = %d, body = %s", first.Code, first.Body.String())
	}
	second := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, testIdempotency, extensionBody(t, map[string]string{"title": "Other Role"})))
	if second.Code != http.StatusConflict {
		t.Fatalf("second status = %d, want 409, body = %s", second.Code, second.Body.String())
	}
	if scout.MemorySubmissionCount(store) != 1 {
		t.Fatalf("count = %d, want 1", scout.MemorySubmissionCount(store))
	}
}

func TestExtensionSubmitAuthMissingSession(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, "", false, testIdempotency, extensionBody(t, nil)))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401, body = %s", rec.Code, rec.Body.String())
	}
}

func TestExtensionSubmitAuthBadSession(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testBadSession, false, testIdempotency, extensionBody(t, nil)))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401, body = %s", rec.Code, rec.Body.String())
	}
}

func TestExtensionSubmitAuthValidBearer(t *testing.T) {
	handler, store := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, false, "bearer-key", extensionBody(t, nil)))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if scout.MemorySubmissionCount(store) != 1 {
		t.Fatalf("count = %d, want 1", scout.MemorySubmissionCount(store))
	}
}

func TestExtensionSubmitAuthValidCookie(t *testing.T) {
	handler, store := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testSession, true, "cookie-key", extensionBody(t, nil)))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if scout.MemorySubmissionCount(store) != 1 {
		t.Fatalf("count = %d, want 1", scout.MemorySubmissionCount(store))
	}
}

func TestExtensionSubmitAuthRejectsNonScout(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodPost, allowedOrigin, testHunterSess, false, testIdempotency, extensionBody(t, nil)))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403, body = %s", rec.Code, rec.Body.String())
	}
}

func TestExtensionSubmitCORSAllowedOrigin(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodOptions, allowedOrigin, "", false, "", nil))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != allowedOrigin {
		t.Fatalf("Allow-Origin = %q, want %q", rec.Header().Get("Access-Control-Allow-Origin"), allowedOrigin)
	}
	if !strings.Contains(rec.Header().Get("Access-Control-Allow-Headers"), httpkit.IdempotencyHeader) {
		t.Fatalf("Allow-Headers = %q", rec.Header().Get("Access-Control-Allow-Headers"))
	}
}

func TestExtensionSubmitCORSDisallowedOrigin(t *testing.T) {
	handler, _ := testExtensionHandler(t)
	rec := doExtension(t, handler, extensionRequest(http.MethodOptions, blockedOrigin, "", false, "", nil))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Allow-Origin = %q, want empty", got)
	}
}

func TestExtensionSubmitCORSDisallowedOriginOnPOST(t *testing.T) {
	handler, store := testExtensionHandler(t)
	req := extensionRequest(http.MethodPost, blockedOrigin, testSession, false, "cors-post", extensionBody(t, nil))
	rec := doExtension(t, handler, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Allow-Origin = %q, want empty", got)
	}
	if scout.MemorySubmissionCount(store) != 1 {
		t.Fatalf("count = %d", scout.MemorySubmissionCount(store))
	}
}
