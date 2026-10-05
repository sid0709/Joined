package auth

import (
	"context"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// MongoDB integration tests - skipped unless MONGODB_TEST_URI is set

func testMongoClient(t *testing.T) *mongo.Client {
	t.Helper()
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("Skipping MongoDB integration test: MONGODB_TEST_URI not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(2*time.Second))
	if err != nil {
		t.Fatalf("mongo connect: %v", err)
	}

	// Test connection
	if err := client.Ping(ctx, nil); err != nil {
		t.Fatalf("mongo ping: %v", err)
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

func TestMongoEmailSignupIntegration(t *testing.T) {
	client := testMongoClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatalf("EnsureIndexes failed: %v", err)
	}

	email := "mongo@example.com"
	userID, created, err := store.EmailSignup(ctx, email, "password123", "Mongo User", RoleCandidate, now)
	if err != nil || !created || userID == "" {
		t.Fatalf("Signup failed: err=%v created=%v userID=%v", err, created, userID)
	}

	// Verify in MongoDB
	var user storedUser
	err = store.collection(usersCollection).FindOne(ctx, bson.D{{Key: "id", Value: userID}}).Decode(&user)
	if err != nil {
		t.Fatalf("User not found in MongoDB: %v", err)
	}
	if user.Email != email {
		t.Errorf("Email mismatch: got %v want %v", user.Email, email)
	}

	// Test duplicate with unique index
	_, created2, err2 := store.EmailSignup(ctx, email, "password123", "Duplicate", RoleCandidate, now)
	if err2 != nil || created2 {
		t.Errorf("Duplicate should return err=nil created=false, got err=%v created=%v", err2, created2)
	}
}

func TestMongoVerificationTokenIntegration(t *testing.T) {
	client := testMongoClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatalf("EnsureIndexes failed: %v", err)
	}

	userID, _, _ := store.EmailSignup(ctx, "verify-mongo@example.com", "password123", "User", RoleCandidate, now)
	token, err := store.CreateVerificationToken(ctx, userID, now)
	if err != nil {
		t.Fatalf("CreateVerificationToken failed: %v", err)
	}

	// Check token stored hashed in MongoDB
	var verification storedVerification
	err = store.collection(verificationCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&verification)
	if err != nil {
		t.Fatalf("Verification not found: %v", err)
	}
	if verification.TokenHash == token {
		t.Error("Token stored raw, should be hashed")
	}
	if verification.TokenHash != hashToken(token) {
		t.Error("Token hash mismatch")
	}

	// Verify email
	if err := store.VerifyEmail(ctx, token, now); err != nil {
		t.Errorf("VerifyEmail failed: %v", err)
	}

	// Check verified in MongoDB
	var user storedUser
	store.collection(usersCollection).FindOne(ctx, bson.D{{Key: "id", Value: userID}}).Decode(&user)
	var authData storedEmailAuth
	store.collection(usersCollection).FindOne(ctx, bson.D{{Key: "id", Value: userID}}).Decode(&authData)
	if !authData.Verified {
		t.Error("User not verified in MongoDB")
	}
}

func TestMongoPasswordResetIntegration(t *testing.T) {
	client := testMongoClient(t)
	store := NewStore(client, testDB, testCompanies)
	ctx := context.Background()
	now := time.Now()

	if err := store.EnsureIndexes(ctx); err != nil {
		t.Fatalf("EnsureIndexes failed: %v", err)
	}

	email := "reset-mongo@example.com"
	userID, _, _ := store.EmailSignup(ctx, email, "oldpassword123", "User", RoleCandidate, now)
	vToken, _ := store.CreateVerificationToken(ctx, userID, now)
	store.VerifyEmail(ctx, vToken, now)

	resetToken, err := store.RequestPasswordReset(ctx, email, now)
	if err != nil {
		t.Fatalf("RequestPasswordReset failed: %v", err)
	}

	// Check token stored hashed in MongoDB
	var reset storedReset
	err = store.collection(resetCollection).FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&reset)
	if err != nil {
		t.Fatalf("Reset not found: %v", err)
	}
	if reset.TokenHash != hashToken(resetToken) {
		t.Error("Reset token hash mismatch")
	}

	// Reset password
	if err := store.ResetPassword(ctx, resetToken, "newpassword123", now); err != nil {
		t.Errorf("ResetPassword failed: %v", err)
	}

	// Verify in MongoDB
	if _, _, err := store.EmailSignin(ctx, email, "newpassword123", AudienceJoined, now); err != nil {
		t.Errorf("New password failed: %v", err)
	}
}
