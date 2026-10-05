package auth

import (
	"context"
	"testing"
	"time"
)

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
	records := &signupCountRecords{}
	store := NewStoreOn(records)
	ctx, now := context.Background(), time.Now()

	var hashCalls int
	originalHasher := store.passwordHasher
	store.passwordHasher = func(password string) ([]byte, []byte, error) {
		hashCalls++
		return originalHasher(password)
	}

	hashCalls = 0
	userID, created, err := store.EmailSignup(ctx, "new@example.com", "password123", "User", RoleCandidate, now)
	if err != nil || !created || userID == "" {
		t.Fatalf("New signup failed")
	}
	if hashCalls != 1 {
		t.Errorf("New signup: hash called %d times, want 1", hashCalls)
	}

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

// signupCountRecords is a test-only AccountRecords that only implements insert.
type signupCountRecords struct {
	created bool
}

func (s *signupCountRecords) InsertUser(ctx context.Context, user AccountUser) error {
	if s.created {
		return ErrEmailTaken
	}
	s.created = true
	return nil
}

func (s *signupCountRecords) UserByEmail(ctx context.Context, email string) (AccountUser, error) {
	return AccountUser{}, ErrNotFound
}

func (s *signupCountRecords) UserByID(ctx context.Context, id string) (AccountUser, error) {
	return AccountUser{}, ErrNotFound
}

func (s *signupCountRecords) SetVerified(ctx context.Context, userID string) error {
	return ErrNotFound
}

func (s *signupCountRecords) SetPassword(ctx context.Context, email string, hash, salt []byte) error {
	return ErrNotFound
}

func (s *signupCountRecords) InsertVerification(ctx context.Context, rec VerificationRecord) error {
	return nil
}

func (s *signupCountRecords) TakeVerification(ctx context.Context, tokenHash string) (VerificationRecord, error) {
	return VerificationRecord{}, ErrNotFound
}

func (s *signupCountRecords) DeleteResets(ctx context.Context, email string) error {
	return nil
}

func (s *signupCountRecords) InsertReset(ctx context.Context, rec ResetRecord) error {
	return nil
}

func (s *signupCountRecords) TakeReset(ctx context.Context, tokenHash string) (ResetRecord, error) {
	return ResetRecord{}, ErrNotFound
}

func (s *signupCountRecords) LoginAttempt(ctx context.Context, email string) (LoginAttemptRecord, error) {
	return LoginAttemptRecord{}, ErrNotFound
}

func (s *signupCountRecords) UpsertLoginAttempt(ctx context.Context, rec LoginAttemptRecord) error {
	return nil
}

func (s *signupCountRecords) DeleteLoginAttempt(ctx context.Context, email string) error {
	return nil
}

func (s *signupCountRecords) InsertSession(ctx context.Context, rec SessionRecord) error {
	return nil
}

func (s *signupCountRecords) DeleteSessionsByUser(ctx context.Context, userID string) error {
	return nil
}

func (s *signupCountRecords) SessionByToken(ctx context.Context, tokenHash string) (SessionRecord, error) {
	return SessionRecord{}, ErrNotFound
}

func (s *signupCountRecords) DeleteUser(ctx context.Context, userID string) error {
	return nil
}

func (s *signupCountRecords) CompanyMembership(ctx context.Context, userID string) (*Company, error) {
	return nil, ErrNotFound
}
