package auth_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/auth/authtest"
)

const auditTTL = time.Hour

func TestIssueAuditSession(t *testing.T) {
	ctx := context.Background()
	now := time.Now()
	store := authtest.NewStore()
	const email = "audit-test@example.com"
	userID, _, err := store.EmailSignup(ctx, email, "password123", "Audit Test", auth.RoleCandidate, now)
	if err != nil {
		t.Fatalf("EmailSignup() error = %v", err)
	}
	otherID, _, err := store.EmailSignup(ctx, "someone@example.com", "password123", "Someone", auth.RoleCandidate, now)
	if err != nil {
		t.Fatalf("EmailSignup() error = %v", err)
	}

	token, user, err := store.IssueAuditSession(ctx, userID, " Audit-Test@example.com ", auditTTL, now)
	if err != nil {
		t.Fatalf("IssueAuditSession() error = %v", err)
	}
	if user.ID != userID {
		t.Errorf("IssueAuditSession() user = %q, want %q", user.ID, userID)
	}
	session, err := store.Session(ctx, token, now)
	if err != nil || session.User.ID != userID {
		t.Fatalf("Session() = %+v, %v; want user %q", session.User, err, userID)
	}
	if _, err := store.Session(ctx, token, now.Add(auditTTL+time.Minute)); !errors.Is(err, auth.ErrInvalidLogin) {
		t.Errorf("Session() after ttl error = %v, want ErrInvalidLogin", err)
	}

	refusals := []struct {
		name, userID, email string
		want                error
	}{
		{"email of another account", otherID, email, auth.ErrAuditUserMismatch},
		{"unknown id", "missing", email, auth.ErrNoAuditUser},
		{"blank id", "", email, auth.ErrInvalidInput},
		{"blank email", userID, "", auth.ErrInvalidInput},
	}
	for _, refusal := range refusals {
		t.Run(refusal.name, func(t *testing.T) {
			_, _, err := store.IssueAuditSession(ctx, refusal.userID, refusal.email, auditTTL, now)
			if !errors.Is(err, refusal.want) {
				t.Errorf("IssueAuditSession() error = %v, want %v", err, refusal.want)
			}
		})
	}
}
