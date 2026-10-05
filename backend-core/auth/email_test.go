package auth

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
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
			if !created {
				t.Error("EmailSignup() created = false, want true")
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
	userID1, created, err := store.EmailSignup(ctx, email, "password123", "First User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("Failed to create first user: %v", err)
	}
	if !created {
		t.Error("First signup should be created")
	}
	if userID1 == "" {
		t.Error("First signup should return userID")
	}

	// Try to create duplicate - should return no error, created=false, empty userID
	userID2, created, err := store.EmailSignup(ctx, email, "password123", "Duplicate User", RoleCandidate, now)
	if err != nil {
		t.Errorf("EmailSignup() duplicate error = %v, want nil", err)
	}
	if created {
		t.Error("Duplicate signup should return created=false")
	}
	if userID2 != "" {
		t.Errorf("Duplicate signup should return empty userID, got %v", userID2)
	}
}

func TestEmailVerification(t *testing.T) {
	client := testClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	// Create a test user
	userID, _, err := store.EmailSignup(ctx, "verify@example.com", "password123", "Verify User", RoleCandidate, now)
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

	// Verify token is stored hashed, not raw
	var verification storedVerification
	err = store.collection(verificationCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&verification)
	if err != nil {
		t.Fatalf("Failed to find verification record: %v", err)
	}
	if verification.TokenHash == token {
		t.Error("Token should be hashed, not stored raw")
	}
	if verification.TokenHash != hashToken(token) {
		t.Error("Token hash doesn't match expected hash")
	}

	// Verify email with raw token
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
	userID, _, err := store.EmailSignup(ctx, email, password, "Sign In User", RoleCandidate, now)
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
	_, _, err = store.EmailSignup(ctx, unverifiedEmail, password, "Unverified User", RoleCandidate, now)
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
	userID, _, err := store.EmailSignup(ctx, email, oldPassword, "Reset User", RoleCandidate, now)
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

	// Verify token is stored hashed, not raw
	var reset storedReset
	err = store.collection(resetCollection).FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&reset)
	if err != nil {
		t.Fatalf("Failed to find reset record: %v", err)
	}
	if reset.TokenHash == resetToken {
		t.Error("Reset token should be hashed, not stored raw")
	}
	if reset.TokenHash != hashToken(resetToken) {
		t.Error("Reset token hash doesn't match expected hash")
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
	userID, _, err := store.EmailSignup(ctx, email, password, "Lockout User", RoleCandidate, now)
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

	// Attempt immediately after lockout should still be locked
	futureShort := now.Add(1 * time.Minute)
	_, _, err = store.EmailSignin(ctx, email, password, AudienceJoined, futureShort)
	if err != ErrAccountLocked {
		t.Errorf("EmailSignin() during lockout period error = %v, want %v", err, ErrAccountLocked)
	}

	// Successful login after lockout period should work (counter is reset)
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

	// After successful login post-lockout, a single wrong attempt should not immediately lock again
	_, _, err = store.EmailSignin(ctx, email, "wrongpassword", AudienceJoined, futureTime.Add(time.Minute))
	if err != ErrInvalidLogin {
		t.Errorf("Single failed attempt after lockout reset should return ErrInvalidLogin, got %v", err)
	}

	// And correct password should still work
	_, _, err = store.EmailSignin(ctx, email, password, AudienceJoined, futureTime.Add(2*time.Minute))
	if err != nil {
		t.Errorf("EmailSignin() after single failed attempt error = %v", err)
	}
}

func TestPasswordHashing(t *testing.T) {
	password := "testpassword123"

	hash1, salt1, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hashPassword() error = %v", err)
	}

	// Verify password matches using crypto/subtle.ConstantTimeCompare
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

func TestConstantTimeCompare(t *testing.T) {
	// Test that verifyPassword uses constant-time comparison
	// We can't directly test timing, but we can verify it works correctly
	password := "test123456"
	hash, salt, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hashPassword() error = %v", err)
	}

	// Correct password should verify
	if !verifyPassword(password, hash, salt) {
		t.Error("verifyPassword should return true for correct password")
	}

	// Wrong password should not verify
	if verifyPassword("wrong123456", hash, salt) {
		t.Error("verifyPassword should return false for wrong password")
	}

	// Empty password should not verify
	if verifyPassword("", hash, salt) {
		t.Error("verifyPassword should return false for empty password")
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

	err = sender.SendDuplicateSignupNotice(ctx, "test@example.com")
	if err != nil {
		t.Errorf("SendDuplicateSignupNotice() error = %v", err)
	}
}

func TestSignupHashingTimingEqualization(t *testing.T) {
	client := testClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	// Ensure indexes
	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatalf("Failed to ensure indexes: %v", err)
	}

	// Track hash calls
	var hashCallCount int
	originalHasher := store.passwordHasher
	store.passwordHasher = func(password string) ([]byte, []byte, error) {
		hashCallCount++
		return originalHasher(password)
	}

	// Test 1: New signup should hash exactly once
	hashCallCount = 0
	email1 := "new@example.com"
	userID, created, err := store.EmailSignup(ctx, email1, "password123", "New User", RoleCandidate, now)
	if err != nil {
		t.Fatalf("New signup error: %v", err)
	}
	if !created {
		t.Error("New signup should be created")
	}
	if userID == "" {
		t.Error("New signup should return userID")
	}
	if hashCallCount != 1 {
		t.Errorf("New signup: hash called %d times, want 1", hashCallCount)
	}

	// Test 2: Duplicate signup should also hash exactly once
	hashCallCount = 0
	userID2, created2, err2 := store.EmailSignup(ctx, email1, "differentpass", "Duplicate User", RoleCandidate, now)
	if err2 != nil {
		t.Fatalf("Duplicate signup error: %v", err2)
	}
	if created2 {
		t.Error("Duplicate signup should not be created")
	}
	if userID2 != "" {
		t.Error("Duplicate signup should return empty userID")
	}
	if hashCallCount != 1 {
		t.Errorf("Duplicate signup: hash called %d times, want 1 (timing equalization)", hashCallCount)
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
