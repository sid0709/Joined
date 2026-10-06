package auth_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/auth/authtest"
)

func TestSuspendBlocksLaterSession(t *testing.T) {
	store := authtest.NewStore()
	ctx := context.Background()
	now := time.Now().UTC()
	userID, _, err := store.EmailSignup(ctx, "held@example.com", "password123", "Held", auth.RoleCandidate, now)
	if err != nil {
		t.Fatal(err)
	}
	token, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.VerifyEmail(ctx, token, now); err != nil {
		t.Fatal(err)
	}
	sessionToken, _, err := store.EmailSignin(ctx, "held@example.com", "password123", auth.AudienceJoined, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SetSuspended(ctx, userID, true, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Session(ctx, sessionToken, now); !errors.Is(err, auth.ErrSuspended) {
		t.Fatalf("session = %v", err)
	}
	found, err := store.AdminLookup(ctx, "held@example.com", "")
	if err != nil || found.SuspendedAt.IsZero() {
		t.Fatalf("lookup = %#v err=%v", found, err)
	}
	if err := store.SetSuspended(ctx, userID, false, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Session(ctx, sessionToken, now); err != nil {
		t.Fatalf("restored session = %v", err)
	}
}
