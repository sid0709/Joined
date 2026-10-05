package auth

import (
	"context"
	"testing"
	"time"
)

// Core unit tests using in-memory store (no MongoDB required)

func TestEmailSignup(t *testing.T) {
	tests := []struct {
		name      string
		email     string
		password  string
		userName  string
		role      string
		wantError error
	}{
		{"valid signup", "test@example.com", "password123", "Test User", RoleCandidate, nil},
		{"weak password", "weak@example.com", "short", "Weak User", RoleCandidate, ErrWeakPassword},
		{"empty email", "", "password123", "No Email", RoleCandidate, ErrInvalidInput},
		{"empty name", "noname@example.com", "password123", "", RoleCandidate, ErrInvalidInput},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewMemStore()
			ctx := context.Background()
			now := time.Now()

			userID, created, err := store.EmailSignup(ctx, tt.email, tt.password, tt.userName, tt.role, now)
			if tt.wantError != nil {
				if err != tt.wantError {
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
	store := NewMemStore()
	ctx := context.Background()
	now := time.Now()

	email := "duplicate@example.com"
	userID1, created1, err1 := store.EmailSignup(ctx, email, "password123", "First", RoleCandidate, now)
	if err1 != nil || !created1 || userID1 == "" {
		t.Fatalf("First signup failed: err=%v created=%v userID=%v", err1, created1, userID1)
	}

	userID2, created2, err2 := store.EmailSignup(ctx, email, "password123", "Duplicate", RoleCandidate, now)
	if err2 != nil || created2 || userID2 != "" {
		t.Errorf("Duplicate should return err=nil created=false userID='', got err=%v created=%v userID=%v", err2, created2, userID2)
	}
}

func TestEmailVerification(t *testing.T) {
	store := NewMemStore()
	ctx, now := context.Background(), time.Now()

	userID, _, err := store.EmailSignup(ctx, "verify@example.com", "password123", "User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("Signup failed: %v", err)
	}

	token, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil || token == "" {
		t.Fatalf("CreateVerificationToken failed: %v", err)
	}

	// Token should be hashed in storage
	ms := store.(*memStore)
	if _, exists := ms.verifications[token]; exists {
		t.Error("Token stored raw, should be hashed")
	}
	if _, exists := ms.verifications[hashToken(token)]; !exists {
		t.Error("Token hash not found in storage")
	}

	// Verify with raw token
	if err := store.VerifyEmail(ctx, token, now); err != nil {
		t.Errorf("VerifyEmail failed: %v", err)
	}

	// Check user verified
	ms = store.(*memStore)
	if !ms.users[userID].verified {
		t.Error("User not verified")
	}

	// Token consumed
	if err := store.VerifyEmail(ctx, token, now); err != ErrInvalidToken {
		t.Errorf("Reused token should fail, got %v", err)
	}
}

func TestEmailSignin(t *testing.T) {
	store := NewMemStore()
	ctx, now := context.Background(), time.Now()
	email, password := "signin@example.com", "password123"

	userID, _, _ := store.EmailSignup(ctx, email, password, "User", RoleCandidate, now)
	token, _ := store.CreateVerificationToken(ctx, userID, now)
	store.VerifyEmail(ctx, token, now)

	sessionToken, session, err := store.EmailSignin(ctx, email, password, AudienceJoined, now)
	if err != nil || sessionToken == "" {
		t.Fatalf("Sign-in failed: %v", err)
	}
	if session.User.ID != userID || session.User.Email != email {
		t.Errorf("Session mismatch: got %+v", session.User)
	}

	// Wrong password
	if _, _, err := store.EmailSignin(ctx, email, "wrong", AudienceJoined, now); err != ErrInvalidLogin {
		t.Errorf("Wrong password should return ErrInvalidLogin, got %v", err)
	}

	// Unverified user
	store.EmailSignup(ctx, "unverified@example.com", password, "Unverified", RoleCandidate, now)
	if _, _, err := store.EmailSignin(ctx, "unverified@example.com", password, AudienceJoined, now); err != ErrEmailNotVerified {
		t.Errorf("Unverified should return ErrEmailNotVerified, got %v", err)
	}
}

func TestPasswordReset(t *testing.T) {
	store := NewMemStore()
	ctx, now := context.Background(), time.Now()
	email, oldPw, newPw := "reset@example.com", "oldpassword123", "newpassword123"

	userID, _, _ := store.EmailSignup(ctx, email, oldPw, "User", RoleCandidate, now)
	vToken, _ := store.CreateVerificationToken(ctx, userID, now)
	store.VerifyEmail(ctx, vToken, now)

	resetToken, err := store.RequestPasswordReset(ctx, email, now)
	if err != nil || resetToken == "" {
		t.Fatalf("RequestPasswordReset failed: %v", err)
	}

	// Token hashed in storage
	ms := store.(*memStore)
	if _, exists := ms.resets[hashToken(resetToken)]; !exists {
		t.Error("Reset token hash not found")
	}

	// Reset password
	if err := store.ResetPassword(ctx, resetToken, newPw, now); err != nil {
		t.Fatalf("ResetPassword failed: %v", err)
	}

	// Old password doesn't work
	if _, _, err := store.EmailSignin(ctx, email, oldPw, AudienceJoined, now); err != ErrInvalidLogin {
		t.Error("Old password should fail")
	}

	// New password works
	if _, _, err := store.EmailSignin(ctx, email, newPw, AudienceJoined, now); err != nil {
		t.Errorf("New password failed: %v", err)
	}
}

func TestLoginAttempts(t *testing.T) {
	store := NewMemStore()
	ctx, now := context.Background(), time.Now()
	email, password := "lockout@example.com", "password123"

	userID, _, _ := store.EmailSignup(ctx, email, password, "User", RoleCandidate, now)
	vToken, _ := store.CreateVerificationToken(ctx, userID, now)
	store.VerifyEmail(ctx, vToken, now)

	// Make failed attempts
	for i := 0; i < maxLoginAttempts; i++ {
		if _, _, err := store.EmailSignin(ctx, email, "wrong", AudienceJoined, now); err != ErrInvalidLogin {
			t.Errorf("Attempt %d: expected ErrInvalidLogin, got %v", i+1, err)
		}
	}

	// Next attempt locked
	if _, _, err := store.EmailSignin(ctx, email, password, AudienceJoined, now); err != ErrAccountLocked {
		t.Errorf("Expected ErrAccountLocked, got %v", err)
	}

	// After lockout expires, counter reset
	future := now.Add(loginLockoutTime + time.Minute)
	if _, _, err := store.EmailSignin(ctx, email, password, AudienceJoined, future); err != nil {
		t.Errorf("After lockout should succeed, got %v", err)
	}

	// Single failure after reset doesn't re-lock
	if _, _, err := store.EmailSignin(ctx, email, "wrong", AudienceJoined, future.Add(time.Minute)); err != ErrInvalidLogin {
		t.Errorf("Single failure should return ErrInvalidLogin, got %v", err)
	}
	if _, _, err := store.EmailSignin(ctx, email, password, AudienceJoined, future.Add(2*time.Minute)); err != nil {
		t.Errorf("After single failure should work, got %v", err)
	}
}

func TestPasswordHashing(t *testing.T) {
	password := "testpassword123"
	hash1, salt1, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hashPassword() error = %v", err)
	}

	if !verifyPassword(password, hash1, salt1) {
		t.Error("verifyPassword() failed for correct password")
	}
	if verifyPassword("wrongpassword", hash1, salt1) {
		t.Error("verifyPassword() succeeded for wrong password")
	}

	hash2, salt2, _ := hashPassword(password)
	if string(hash1) == string(hash2) || string(salt1) == string(salt2) {
		t.Error("Different hashPassword calls should produce different hashes and salts")
	}
}

func TestConstantTimeCompare(t *testing.T) {
	password := "test123456"
	hash, salt, _ := hashPassword(password)

	if !verifyPassword(password, hash, salt) {
		t.Error("Correct password should verify")
	}
	if verifyPassword("wrong123456", hash, salt) || verifyPassword("", hash, salt) {
		t.Error("Wrong password should not verify")
	}
}

func TestSignupHashingTimingEqualization(t *testing.T) {
	store := NewMemStore()
	ctx, now := context.Background(), time.Now()

	var hashCalls int
	ms := store.(*memStore)
	originalHasher := ms.passwordHasher
	ms.passwordHasher = func(password string) ([]byte, []byte, error) {
		hashCalls++
		return originalHasher(password)
	}

	// New signup: hash called once
	hashCalls = 0
	userID, created, err := store.EmailSignup(ctx, "new@example.com", "password123", "User", RoleCandidate, now)
	if err != nil || !created || userID == "" {
		t.Fatalf("New signup failed")
	}
	if hashCalls != 1 {
		t.Errorf("New signup: hash called %d times, want 1", hashCalls)
	}

	// Duplicate signup: hash also called once
	hashCalls = 0
	userID2, created2, err2 := store.EmailSignup(ctx, "new@example.com", "differentpass", "Dup", RoleCandidate, now)
	if err2 != nil || created2 || userID2 != "" {
		t.Fatalf("Duplicate signup wrong result")
	}
	if hashCalls != 1 {
		t.Errorf("Duplicate signup: hash called %d times, want 1 (timing equalization)", hashCalls)
	}
}

func TestDevEmailSender(t *testing.T) {
	sender := DevEmailSender{}
	ctx := context.Background()

	if err := sender.SendVerification(ctx, "test@example.com", "User", "token123"); err != nil {
		t.Errorf("SendVerification() error = %v", err)
	}
	if err := sender.SendPasswordReset(ctx, "test@example.com", "User", "token456"); err != nil {
		t.Errorf("SendPasswordReset() error = %v", err)
	}
	if err := sender.SendDuplicateSignupNotice(ctx, "test@example.com"); err != nil {
		t.Errorf("SendDuplicateSignupNotice() error = %v", err)
	}
}
