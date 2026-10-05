package auth

import (
	"context"
	"time"
)

// AccountRecords persists users, verification and reset tokens, login
// attempts, and sessions. Store keeps hashing, lockout, expiry, and
// constant-time compare.
type AccountRecords interface {
	InsertUser(ctx context.Context, user AccountUser) error
	UserByEmail(ctx context.Context, email string) (AccountUser, error)
	UserByID(ctx context.Context, id string) (AccountUser, error)
	SetVerified(ctx context.Context, userID string) error
	SetPassword(ctx context.Context, email string, hash, salt []byte) error

	InsertVerification(ctx context.Context, rec VerificationRecord) error
	TakeVerification(ctx context.Context, tokenHash string) (VerificationRecord, error)

	DeleteResets(ctx context.Context, email string) error
	InsertReset(ctx context.Context, rec ResetRecord) error
	TakeReset(ctx context.Context, tokenHash string) (ResetRecord, error)

	LoginAttempt(ctx context.Context, email string) (LoginAttemptRecord, error)
	UpsertLoginAttempt(ctx context.Context, rec LoginAttemptRecord) error
	DeleteLoginAttempt(ctx context.Context, email string) error

	InsertSession(ctx context.Context, rec SessionRecord) error
	DeleteSessionsByUser(ctx context.Context, userID string) error
}

// AccountUser is one stored account, including email-auth fields.
type AccountUser struct {
	ID           string
	Name         string
	Email        string
	Role         string
	PasswordHash []byte
	PasswordSalt []byte
	Verified     bool
	CreatedAt    time.Time
}

// VerificationRecord is a single-use email verification token at rest.
type VerificationRecord struct {
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	CreatedAt time.Time
}

// ResetRecord is a single-use password reset token at rest.
type ResetRecord struct {
	Email     string
	TokenHash string
	ExpiresAt time.Time
	CreatedAt time.Time
}

// LoginAttemptRecord is failed-signin state for one email.
type LoginAttemptRecord struct {
	Email       string
	Attempts    int
	LockedUntil time.Time
	UpdatedAt   time.Time
}

// SessionRecord is a signed-in session at rest.
type SessionRecord struct {
	TokenHash string
	UserID    string
	ExpiresAt time.Time
	CreatedAt time.Time
}

// NewStoreOn builds a Store that runs the real auth logic on records.
func NewStoreOn(records AccountRecords) *Store {
	return &Store{
		records:        records,
		passwordHasher: hashPassword,
	}
}
