package auth

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
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
		{
			name:      "valid signup",
			email:     "test@example.com",
			password:  "password123",
			userName:  "Test User",
			role:      RoleCandidate,
			wantError: nil,
		},
		{
			name:      "weak password",
			email:     "weak@example.com",
			password:  "short",
			userName:  "Weak User",
			role:      RoleCandidate,
			wantError: ErrWeakPassword,
		},
		{
			name:      "empty email",
			email:     "",
			password:  "password123",
			userName:  "No Email",
			role:      RoleCandidate,
			wantError: ErrInvalidInput,
		},
		{
			name:      "empty name",
			email:     "noname@example.com",
			password:  "password123",
			userName:  "",
			role:      RoleCandidate,
			wantError: ErrInvalidInput,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := testClient(t)
			store := NewStore(client, testDB, testCompanies)
			ctx := context.Background()
			now := time.Now()

			userID, err := store.EmailSignup(ctx, tt.email, tt.password, tt.userName, tt.role, now)
			if tt.wantError != nil {
				if err != tt.wantError {
					t.Errorf("EmailSignup() error = %v, wantError %v", err, tt.wantError)
				}
				return
			}
			if err != nil {
				t.Fatalf("EmailSignup() unexpected error = %v", err)
			}
			if userID == "" {
				t.Error("EmailSignup() returned empty userID")
			}

			// Verify user was created
			var user storedUser
			err = store.collection(usersCollection).FindOne(ctx, map[string]string{"id": userID}).Decode(&user)
			if err != nil {
				t.Fatalf("Failed to find created user: %v", err)
			}
			if user.Email != normalizeEmail(tt.email) {
				t.Errorf("User email = %v, want %v", user.Email, normalizeEmail(tt.email))
			}
			if user.Role != tt.role {
				t.Errorf("User role = %v, want %v", user.Role, tt.role)
			}

			// Verify password fields exist
			var authData storedEmailAuth
			err = store.collection(usersCollection).FindOne(ctx, map[string]string{"id": userID}).Decode(&authData)
			if err != nil {
				t.Fatalf("Failed to decode auth data: %v", err)
			}
			if len(authData.PasswordHash) == 0 {
				t.Error("Password hash is empty")
			}
			if len(authData.PasswordSalt) == 0 {
				t.Error("Password salt is empty")
			}
			if authData.Verified {
				t.Error("New account should not be verified")
			}
		})
	}
}

func TestEmailSignupDuplicate(t *testing.T) {
	client := testClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	// Ensure indexes are created
	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatalf("Failed to ensure indexes: %v", err)
	}

	email := "duplicate@example.com"
	
	// Create first user
	_, err := store.EmailSignup(ctx, email, "password123", "First User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create first user: %v", err)
	}

	// Try to create duplicate
	_, err = store.EmailSignup(ctx, email, "password123", "Duplicate User", RoleCandidate, now)
	if err != ErrEmailTaken {
		t.Errorf("EmailSignup() duplicate error = %v, want %v", err, ErrEmailTaken)
	}
}

func TestEmailVerification(t *testing.T) {
	client := testClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	// Create a test user
	userID, err := store.EmailSignup(ctx, "verify@example.com", "password123", "Verify User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create verification token
	token, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatalf("Failed to create verification token: %v", err)
	}
	if token == "" {
		t.Fatal("Verification token is empty")
	}

	// Verify email
	err = store.VerifyEmail(ctx, token, now)
	if err != nil {
		t.Fatalf("VerifyEmail() error = %v", err)
	}

	// Check user is verified
	var user storedUser
	var authData storedEmailAuth
	err = store.collection(usersCollection).FindOne(ctx, map[string]string{"id": userID}).Decode(&user)
	if err != nil {
		t.Fatalf("Failed to find user: %v", err)
	}
	err = store.collection(usersCollection).FindOne(ctx, map[string]string{"id": userID}).Decode(&authData)
	if err != nil {
		t.Fatalf("Failed to decode auth data: %v", err)
	}
	if !authData.Verified {
		t.Error("User should be verified")
	}

	// Verify token is consumed
	err = store.VerifyEmail(ctx, token, now)
	if err != ErrInvalidToken {
		t.Errorf("VerifyEmail() with used token error = %v, want %v", err, ErrInvalidToken)
	}
}

func TestEmailSignin(t *testing.T) {
	client := testClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	email := "signin@example.com"
	password := "password123"

	// Create and verify user
	userID, err := store.EmailSignup(ctx, email, password, "Sign In User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	token, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatalf("Failed to create verification token: %v", err)
	}
	err = store.VerifyEmail(ctx, token, now)
	if err != nil {
		t.Fatalf("Failed to verify email: %v", err)
	}

	// Test successful sign-in
	sessionToken, session, err := store.EmailSignin(ctx, email, password, AudienceJoined, now)
	if err != nil {
		t.Fatalf("EmailSignin() error = %v", err)
	}
	if sessionToken == "" {
		t.Error("Session token is empty")
	}
	if session.User.ID != userID {
		t.Errorf("Session user ID = %v, want %v", session.User.ID, userID)
	}
	if session.User.Email != normalizeEmail(email) {
		t.Errorf("Session user email = %v, want %v", session.User.Email, normalizeEmail(email))
	}

	// Test wrong password
	_, _, err = store.EmailSignin(ctx, email, "wrongpassword", AudienceJoined, now)
	if err != ErrInvalidLogin {
		t.Errorf("EmailSignin() with wrong password error = %v, want %v", err, ErrInvalidLogin)
	}

	// Test unverified user
	unverifiedEmail := "unverified@example.com"
	_, err = store.EmailSignup(ctx, unverifiedEmail, password, "Unverified User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create unverified user: %v", err)
	}
	_, _, err = store.EmailSignin(ctx, unverifiedEmail, password, AudienceJoined, now)
	if err != ErrEmailNotVerified {
		t.Errorf("EmailSignin() with unverified user error = %v, want %v", err, ErrEmailNotVerified)
	}

	// Test nonexistent user
	_, _, err = store.EmailSignin(ctx, "nonexistent@example.com", password, AudienceJoined, now)
	if err != ErrInvalidLogin {
		t.Errorf("EmailSignin() with nonexistent user error = %v, want %v", err, ErrInvalidLogin)
	}
}

func TestPasswordReset(t *testing.T) {
	client := testClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	email := "reset@example.com"
	oldPassword := "oldpassword123"
	newPassword := "newpassword123"

	// Create and verify user
	userID, err := store.EmailSignup(ctx, email, oldPassword, "Reset User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	verifyToken, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatalf("Failed to create verification token: %v", err)
	}
	err = store.VerifyEmail(ctx, verifyToken, now)
	if err != nil {
		t.Fatalf("Failed to verify email: %v", err)
	}

	// Request password reset
	resetToken, err := store.RequestPasswordReset(ctx, email, now)
	if err != nil {
		t.Fatalf("RequestPasswordReset() error = %v", err)
	}
	if resetToken == "" {
		t.Fatal("Reset token is empty")
	}

	// Reset password
	err = store.ResetPassword(ctx, resetToken, newPassword, now)
	if err != nil {
		t.Fatalf("ResetPassword() error = %v", err)
	}

	// Verify old password doesn't work
	_, _, err = store.EmailSignin(ctx, email, oldPassword, AudienceJoined, now)
	if err != ErrInvalidLogin {
		t.Errorf("EmailSignin() with old password error = %v, want %v", err, ErrInvalidLogin)
	}

	// Verify new password works
	_, _, err = store.EmailSignin(ctx, email, newPassword, AudienceJoined, now)
	if err != nil {
		t.Errorf("EmailSignin() with new password error = %v", err)
	}

	// Verify token is consumed
	err = store.ResetPassword(ctx, resetToken, "anotherpassword123", now)
	if err != ErrInvalidToken {
		t.Errorf("ResetPassword() with used token error = %v, want %v", err, ErrInvalidToken)
	}

	// Test weak password
	resetToken2, err := store.RequestPasswordReset(ctx, email, now)
	if err != nil {
		t.Fatalf("RequestPasswordReset() error = %v", err)
	}
	err = store.ResetPassword(ctx, resetToken2, "short", now)
	if err != ErrWeakPassword {
		t.Errorf("ResetPassword() with weak password error = %v, want %v", err, ErrWeakPassword)
	}
}

func TestLoginAttempts(t *testing.T) {
	client := testClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	email := "lockout@example.com"
	password := "password123"

	// Create and verify user
	userID, err := store.EmailSignup(ctx, email, password, "Lockout User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	verifyToken, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatalf("Failed to create verification token: %v", err)
	}
	err = store.VerifyEmail(ctx, verifyToken, now)
	if err != nil {
		t.Fatalf("Failed to verify email: %v", err)
	}

	// Make failed login attempts
	for i := 0; i < maxLoginAttempts; i++ {
		_, _, err = store.EmailSignin(ctx, email, "wrongpassword", AudienceJoined, now)
		if err != ErrInvalidLogin {
			t.Errorf("Attempt %d: EmailSignin() error = %v, want %v", i+1, err, ErrInvalidLogin)
		}
	}

	// Next attempt should be locked out
	_, _, err = store.EmailSignin(ctx, email, password, AudienceJoined, now)
	if err != ErrAccountLocked {
		t.Errorf("EmailSignin() after lockout error = %v, want %v", err, ErrAccountLocked)
	}

	// Successful login after lockout period should work
	futureTime := now.Add(loginLockoutTime + time.Minute)
	sessionToken, session, err := store.EmailSignin(ctx, email, password, AudienceJoined, futureTime)
	if err != nil {
		t.Errorf("EmailSignin() after lockout period error = %v", err)
	}
	if sessionToken == "" {
		t.Error("Session token is empty after lockout period")
	}
	if session.User.ID != userID {
		t.Errorf("Session user ID = %v, want %v", session.User.ID, userID)
	}
}

func TestPasswordHashing(t *testing.T) {
	password := "testpassword123"

	hash1, salt1, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hashPassword() error = %v", err)
	}

	// Verify password matches
	if !verifyPassword(password, hash1, salt1) {
		t.Error("verifyPassword() failed for correct password")
	}

	// Verify wrong password doesn't match
	if verifyPassword("wrongpassword", hash1, salt1) {
		t.Error("verifyPassword() succeeded for wrong password")
	}

	// Verify different salts produce different hashes
	hash2, salt2, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hashPassword() error = %v", err)
	}
	if string(hash1) == string(hash2) {
		t.Error("Same password with different salts produced same hash")
	}
	if string(salt1) == string(salt2) {
		t.Error("Two hashPassword calls produced same salt")
	}
}

func TestSubtleEqual(t *testing.T) {
	tests := []struct {
		name string
		a    []byte
		b    []byte
		want bool
	}{
		{"equal bytes", []byte{1, 2, 3}, []byte{1, 2, 3}, true},
		{"different bytes", []byte{1, 2, 3}, []byte{1, 2, 4}, false},
		{"different length", []byte{1, 2}, []byte{1, 2, 3}, false},
		{"empty equal", []byte{}, []byte{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := subtleEqual(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("subtleEqual() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDevEmailSender(t *testing.T) {
	sender := DevEmailSender{}
	ctx := context.Background()

	// Just verify these don't panic or error
	err := sender.SendVerification(ctx, "test@example.com", "Test User", "token123")
	if err != nil {
		t.Errorf("SendVerification() error = %v", err)
	}

	err = sender.SendPasswordReset(ctx, "test@example.com", "Test User", "token456")
	if err != nil {
		t.Errorf("SendPasswordReset() error = %v", err)
	}
}

func testClient(t *testing.T) *mongo.Client {
	t.Helper()
	uri := "mongodb://localhost:27017"
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatalf("mongo connect: %v", err)
	}
	t.Cleanup(func() {
		if err := client.Database(testDB).Drop(context.Background()); err != nil {
			t.Logf("drop test database: %v", err)
		}
		if err := client.Disconnect(context.Background()); err != nil {
			t.Logf("disconnect: %v", err)
		}
	})
	return client
}

const (
	testDB        = "test_email_auth"
	testCompanies = "test_companies"
)
