package auth_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/auth/authtest"
)

func TestEmailSignup(t *testing.T) {
	tests := []struct {
		name      string
		email     string
		password  string
		userName  string
		role      string
		wantError error
	}{
		{"valid signup", "test@example.com", "password123", "Test User", auth.RoleCandidate, nil},
		{"weak password", "weak@example.com", "short", "Weak User", auth.RoleCandidate, auth.ErrWeakPassword},
		{"empty email", "", "password123", "No Email", auth.RoleCandidate, auth.ErrInvalidInput},
		{"empty name", "noname@example.com", "password123", "", auth.RoleCandidate, auth.ErrInvalidInput},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := authtest.NewStore()
			ctx := context.Background()
			now := time.Now()

			userID, created, err := store.EmailSignup(ctx, tt.email, tt.password, tt.userName, tt.role, now)
			if tt.wantError != nil {
				if !errors.Is(err, tt.wantError) {
					t.Errorf("EmailSignup() error = %v, wantError %v", err, tt.wantError)
				}
				return
			}
			if err != nil {
				t.Fatalf("EmailSignup() unexpected error = %v", err)
			}
			if !created || userID == "" {
				t.Error("EmailSignup() should return created=true and non-empty userID")
			}
		})
	}
}

func TestEmailSignupDuplicate(t *testing.T) {
	store := authtest.NewStore()
	ctx := context.Background()
	now := time.Now()

	email := "duplicate@example.com"
	userID1, created1, err1 := store.EmailSignup(ctx, email, "password123", "First", auth.RoleCandidate, now)
	if err1 != nil || !created1 || userID1 == "" {
		t.Fatalf("First signup failed: err=%v created=%v userID=%v", err1, created1, userID1)
	}

	userID2, created2, err2 := store.EmailSignup(ctx, email, "password123", "Duplicate", auth.RoleCandidate, now)
	if err2 != nil || created2 || userID2 != "" {
		t.Errorf("Duplicate should return err=nil created=false userID='', got err=%v created=%v userID=%v", err2, created2, userID2)
	}
}

func TestEmailVerification(t *testing.T) {
	store := authtest.NewStore()
	ctx, now := context.Background(), time.Now()
	email, password := "verify@example.com", "password123"

	userID, _, err := store.EmailSignup(ctx, email, password, "User", auth.RoleCandidate, now)
	if err != nil {
		t.Fatalf("Signup failed: %v", err)
	}

	if _, _, err := store.EmailSignin(ctx, email, password, auth.AudienceJoined, now); !errors.Is(err, auth.ErrEmailNotVerified) {
		t.Errorf("unverified sign-in = %v, want ErrEmailNotVerified", err)
	}

	token, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil || token == "" {
		t.Fatalf("CreateVerificationToken failed: %v", err)
	}

	if err := store.VerifyEmail(ctx, token, now); err != nil {
		t.Errorf("VerifyEmail failed: %v", err)
	}

	if _, _, err := store.EmailSignin(ctx, email, password, auth.AudienceJoined, now); err != nil {
		t.Errorf("verified sign-in failed: %v", err)
	}

	if err := store.VerifyEmail(ctx, token, now); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("Reused token should fail, got %v", err)
	}
	if err := store.VerifyEmail(ctx, token+"x", now); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("Unknown token should fail, got %v", err)
	}
}

func TestEmailSignin(t *testing.T) {
	store := authtest.NewStore()
	ctx, now := context.Background(), time.Now()
	email, password := "signin@example.com", "password123"

	userID, _, _ := store.EmailSignup(ctx, email, password, "User", auth.RoleCandidate, now)
	token, _ := store.CreateVerificationToken(ctx, userID, now)
	store.VerifyEmail(ctx, token, now)

	sessionToken, session, err := store.EmailSignin(ctx, email, password, auth.AudienceJoined, now)
	if err != nil || sessionToken == "" {
		t.Fatalf("Sign-in failed: %v", err)
	}
	if session.User.ID != userID || session.User.Email != email {
		t.Errorf("Session mismatch: got %+v", session.User)
	}

	if _, _, err := store.EmailSignin(ctx, email, "wrong", auth.AudienceJoined, now); !errors.Is(err, auth.ErrInvalidLogin) {
		t.Errorf("Wrong password should return ErrInvalidLogin, got %v", err)
	}

	store.EmailSignup(ctx, "unverified@example.com", password, "Unverified", auth.RoleCandidate, now)
	if _, _, err := store.EmailSignin(ctx, "unverified@example.com", password, auth.AudienceJoined, now); !errors.Is(err, auth.ErrEmailNotVerified) {
		t.Errorf("Unverified should return ErrEmailNotVerified, got %v", err)
	}
}

func TestPasswordReset(t *testing.T) {
	store := authtest.NewStore()
	ctx, now := context.Background(), time.Now()
	email, oldPw, newPw := "reset@example.com", "oldpassword123", "newpassword123"

	userID, _, _ := store.EmailSignup(ctx, email, oldPw, "User", auth.RoleCandidate, now)
	vToken, _ := store.CreateVerificationToken(ctx, userID, now)
	store.VerifyEmail(ctx, vToken, now)

	resetToken, err := store.RequestPasswordReset(ctx, email, now)
	if err != nil || resetToken == "" {
		t.Fatalf("RequestPasswordReset failed: %v", err)
	}

	if err := store.ResetPassword(ctx, resetToken+"x", newPw, now); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("unknown reset token = %v, want ErrInvalidToken", err)
	}

	if err := store.ResetPassword(ctx, resetToken, newPw, now); err != nil {
		t.Fatalf("ResetPassword failed: %v", err)
	}

	if _, _, err := store.EmailSignin(ctx, email, oldPw, auth.AudienceJoined, now); !errors.Is(err, auth.ErrInvalidLogin) {
		t.Error("Old password should fail")
	}

	if _, _, err := store.EmailSignin(ctx, email, newPw, auth.AudienceJoined, now); err != nil {
		t.Errorf("New password failed: %v", err)
	}

	if err := store.ResetPassword(ctx, resetToken, newPw, now); !errors.Is(err, auth.ErrInvalidToken) {
		t.Errorf("reused reset token = %v, want ErrInvalidToken", err)
	}
}

func TestLoginAttempts(t *testing.T) {
	store := authtest.NewStore()
	ctx, now := context.Background(), time.Now()
	email, password := "lockout@example.com", "password123"

	userID, _, _ := store.EmailSignup(ctx, email, password, "User", auth.RoleCandidate, now)
	vToken, _ := store.CreateVerificationToken(ctx, userID, now)
	store.VerifyEmail(ctx, vToken, now)

	for i := 0; i < 5; i++ {
		if _, _, err := store.EmailSignin(ctx, email, "wrong", auth.AudienceJoined, now); !errors.Is(err, auth.ErrInvalidLogin) {
			t.Errorf("Attempt %d: expected ErrInvalidLogin, got %v", i+1, err)
		}
	}

	if _, _, err := store.EmailSignin(ctx, email, password, auth.AudienceJoined, now); !errors.Is(err, auth.ErrAccountLocked) {
		t.Errorf("Expected ErrAccountLocked, got %v", err)
	}

	future := now.Add(15*time.Minute + time.Minute)
	if _, _, err := store.EmailSignin(ctx, email, password, auth.AudienceJoined, future); err != nil {
		t.Errorf("After lockout should succeed, got %v", err)
	}

	if _, _, err := store.EmailSignin(ctx, email, "wrong", auth.AudienceJoined, future.Add(time.Minute)); !errors.Is(err, auth.ErrInvalidLogin) {
		t.Errorf("Single failure should return ErrInvalidLogin, got %v", err)
	}
	if _, _, err := store.EmailSignin(ctx, email, password, auth.AudienceJoined, future.Add(2*time.Minute)); err != nil {
		t.Errorf("After single failure should work, got %v", err)
	}
}
