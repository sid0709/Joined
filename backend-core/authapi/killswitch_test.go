package authapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

func TestSignupKillSwitch(t *testing.T) {
	store := newTestStore()
	sender := &testEmailSender{}
	handlers := Handlers{
		Accounts: store,
		Audience: auth.AudienceJoined,
		Email:    &EmailAuth{Sender: sender},
		Switches: killswitch.NewMemory(killswitch.Defaults{killswitch.Signup: false}),
	}
	mux := http.NewServeMux()
	handlers.Register(mux)
	body, _ := json.Marshal(map[string]string{
		"email":    "new@example.com",
		"password": "password123",
		"name":     "New User",
	})
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/auth/signup", bytes.NewReader(body)))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/auth/signin", bytes.NewReader(body)))
	if rec.Code == http.StatusServiceUnavailable {
		t.Fatal("sign-in should stay up when only sign-up is off")
	}
}

func TestGoogleUserExistsOnMemoryStore(t *testing.T) {
	store := newTestStore()
	id := auth.GoogleIdentity{Subject: "sub-1", Email: "hunter@example.com"}
	exists, err := store.GoogleUserExists(context.Background(), id)
	if err != nil || exists {
		t.Fatalf("empty store = exists %v err %v", exists, err)
	}
	if _, _, err := store.EmailSignup(context.Background(), id.Email, "password123", "Hunter", auth.RoleCandidate, time.Now()); err != nil {
		t.Fatal(err)
	}
	exists, err = store.GoogleUserExists(context.Background(), id)
	if err != nil || !exists {
		t.Fatalf("after signup = exists %v err %v", exists, err)
	}
}

func TestEmailKillSwitchSkipsSendAndBlocksReset(t *testing.T) {
	store := newTestStore()
	sender := &testEmailSender{}
	handlers := Handlers{
		Accounts: store,
		Audience: auth.AudienceJoined,
		Email:    &EmailAuth{Sender: sender},
		Switches: killswitch.NewMemory(killswitch.Defaults{killswitch.Email: false}),
	}
	mux := http.NewServeMux()
	handlers.Register(mux)
	body, _ := json.Marshal(map[string]string{
		"email":    "mail@example.com",
		"password": "password123",
		"name":     "Mail User",
	})
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/auth/signup", bytes.NewReader(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("signup with email off = %d %s", rec.Code, rec.Body.String())
	}
	if len(sender.verifications) != 0 {
		t.Fatalf("sent verification while email killed: %+v", sender.verifications)
	}

	resetBody, _ := json.Marshal(map[string]string{"email": "mail@example.com"})
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/auth/password/reset-request", bytes.NewReader(resetBody)))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("reset-request = %d %s", rec.Code, rec.Body.String())
	}
}
