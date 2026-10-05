package authapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/auth/authtest"
)

type swappingSource struct {
	otherEmail string
}

func (s swappingSource) Collect(_ context.Context, user auth.User, now time.Time) (auth.AccountExport, error) {
	bundle := auth.EmptyExport(user, now)
	bundle.User = auth.User{ID: "someone-else", Email: s.otherEmail, Name: "Other", Role: auth.RoleCandidate}
	bundle.Profile = map[string]string{"owner": user.Email}
	return bundle, nil
}

func TestExportAccountIsolatesRateLimitsAndKeepsDelete(t *testing.T) {
	store := authtest.NewStore()
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	other := "hidden-person@other.test"
	store.SetAccountSource(swappingSource{otherEmail: other})
	ctx := context.Background()

	tokenA := signInCandidate(t, store, "ada@example.com", now)
	tokenB := signInCandidate(t, store, "grace@example.com", now)

	bundle, err := store.ExportAccount(ctx, tokenA, now)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(bundle)
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	if strings.Contains(text, other) || strings.Contains(text, "someone-else") {
		t.Fatalf("export included another account: %s", text)
	}
	if !strings.Contains(text, "ada@example.com") || strings.Contains(text, "grace@example.com") {
		t.Fatalf("export was not limited to the caller: %s", text)
	}
	if strings.Contains(text, "passwordHash") || strings.Contains(text, "refreshToken") {
		t.Fatalf("export named a secret field: %s", text)
	}

	if _, err := store.ExportAccount(ctx, tokenA, now.Add(time.Minute)); !errors.Is(err, auth.ErrExportLimited) {
		t.Fatalf("second export err = %v, want rate limit", err)
	}
	if _, err := store.ExportAccount(ctx, tokenB, now); err != nil {
		t.Fatalf("other account export: %v", err)
	}

	if err := store.DeleteAccount(ctx, tokenA, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Session(ctx, tokenA, now); err == nil {
		t.Fatal("deleted account session still loads")
	}
}

func TestAccountExportHTTP(t *testing.T) {
	store := authtest.NewStore()
	now := time.Now().UTC()
	secret := "bundle-note-not-for-logs"
	store.SetAccountSource(logTrap{secret: secret})
	token := signInCandidate(t, store, "ada@example.com", now)

	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	handlers := Handlers{Accounts: store, Audience: auth.AudienceJoined}
	mux := http.NewServeMux()
	handlers.Register(mux)

	denied := httptest.NewRequest(http.MethodGet, "/v1/auth/account/export", nil)
	deniedRec := httptest.NewRecorder()
	mux.ServeHTTP(deniedRec, denied)
	if deniedRec.Code != http.StatusUnauthorized {
		t.Fatalf("signed out status = %d", deniedRec.Code)
	}

	ok := httptest.NewRequest(http.MethodGet, "/v1/auth/account/export", nil)
	ok.Header.Set("Authorization", "Bearer "+token)
	okRec := httptest.NewRecorder()
	mux.ServeHTTP(okRec, ok)
	if okRec.Code != http.StatusOK {
		t.Fatalf("export status = %d body = %s", okRec.Code, okRec.Body.String())
	}
	if !strings.Contains(okRec.Body.String(), "ada@example.com") || !strings.Contains(okRec.Body.String(), secret) {
		t.Fatalf("body = %s", okRec.Body.String())
	}
	if strings.Contains(logs.String(), secret) || strings.Contains(logs.String(), "ada@example.com") {
		t.Fatalf("export payload was logged: %s", logs.String())
	}

	again := httptest.NewRequest(http.MethodGet, "/v1/auth/account/export", nil)
	again.Header.Set("Authorization", "Bearer "+token)
	againRec := httptest.NewRecorder()
	mux.ServeHTTP(againRec, again)
	if againRec.Code != http.StatusTooManyRequests {
		t.Fatalf("rate limit status = %d body = %s", againRec.Code, againRec.Body.String())
	}

	del := httptest.NewRequest(http.MethodDelete, "/v1/auth/account", nil)
	del.Header.Set("Authorization", "Bearer "+token)
	delRec := httptest.NewRecorder()
	mux.ServeHTTP(delRec, del)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d body = %s", delRec.Code, delRec.Body.String())
	}
}

type logTrap struct {
	secret string
}

func (s logTrap) Collect(_ context.Context, user auth.User, now time.Time) (auth.AccountExport, error) {
	bundle := auth.EmptyExport(user, now)
	bundle.Profile = map[string]string{"note": s.secret}
	return bundle, nil
}

func signInCandidate(t *testing.T, store *auth.Store, email string, now time.Time) string {
	t.Helper()
	ctx := context.Background()
	id, _, err := store.EmailSignup(ctx, email, "password123", "Ada", auth.RoleCandidate, now)
	if err != nil {
		t.Fatal(err)
	}
	verify, err := store.CreateVerificationToken(ctx, id, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.VerifyEmail(ctx, verify, now); err != nil {
		t.Fatal(err)
	}
	token, _, err := store.EmailSignin(ctx, email, "password123", auth.AudienceJoined, now)
	if err != nil {
		t.Fatal(err)
	}
	return token
}
