package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"log/slog"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/argon2"
)

const (
	verificationTokenBytes = 32
	resetTokenBytes        = 32
	verificationTTL        = 24 * time.Hour
	resetTTL               = 1 * time.Hour
	// Argon2id parameters: balance security and latency
	argonTime    = 1
	argonMemory  = 64 * 1024
	argonThreads = 4
	argonKeyLen  = 32
	saltBytes    = 16
	// Rate limiting
	maxLoginAttempts        = 5
	loginLockoutTime        = 15 * time.Minute
	verificationCollection  = "email_verifications"
	resetCollection         = "password_resets"
	loginAttemptsCollection = "login_attempts"
)

var (
	ErrEmailNotVerified = errors.New("please verify your email before signing in")
	ErrInvalidToken     = errors.New("this link is expired or invalid")
	ErrAccountLocked    = errors.New("too many failed attempts; try again in 15 minutes")
	ErrWeakPassword     = errors.New("password must be at least 8 characters")
)

// EmailSender delivers verification and password reset messages.
type EmailSender interface {
	SendVerification(ctx context.Context, to, name, token string) error
	SendPasswordReset(ctx context.Context, to, name, token string) error
	SendDuplicateSignupNotice(ctx context.Context, to string) error
}

type storedEmailAuth struct {
	PasswordHash []byte `bson:"passwordHash,omitempty"`
	PasswordSalt []byte `bson:"passwordSalt,omitempty"`
	Verified     bool   `bson:"verified,omitempty"`
}

type storedVerification struct {
	UserID    string    `bson:"userId"`
	TokenHash string    `bson:"tokenHash"`
	ExpiresAt time.Time `bson:"expiresAt"`
	CreatedAt time.Time `bson:"createdAt"`
}

type storedReset struct {
	Email     string    `bson:"email"`
	TokenHash string    `bson:"tokenHash"`
	ExpiresAt time.Time `bson:"expiresAt"`
	CreatedAt time.Time `bson:"createdAt"`
}

type storedLoginAttempt struct {
	Email       string    `bson:"email"`
	Attempts    int       `bson:"attempts"`
	LockedUntil time.Time `bson:"lockedUntil,omitempty"`
	UpdatedAt   time.Time `bson:"updatedAt"`
}

// EmailSignup creates an account with email and password that must be verified.
// Returns the user ID if the account was created, or empty string if email is already taken.
// Callers should treat both cases identically to prevent user enumeration.
// Always hashes the password (even for duplicates) to prevent timing attacks.
func (s *Store) EmailSignup(ctx context.Context, email, password, name, role string, now time.Time) (string, bool, error) {
	email = normalizeEmail(email)
	if email == "" || name == "" {
		return "", false, ErrInvalidInput
	}
	name = strings.TrimSpace(name)
	if len([]rune(name)) > maxNameLength {
		return "", false, ErrInvalidInput
	}
	if len(password) < 8 {
		return "", false, ErrWeakPassword
	}

	// Always hash the password, even if email is taken, to prevent timing attacks
	passwordHash, passwordSalt, err := s.passwordHasher(password)
	if err != nil {
		return "", false, err
	}

	userID, err := newPublicID()
	if err != nil {
		return "", false, err
	}

	err = s.records.InsertUser(ctx, AccountUser{
		ID:           userID,
		Name:         name,
		Email:        email,
		Role:         role,
		PasswordHash: passwordHash,
		PasswordSalt: passwordSalt,
		Verified:     false,
		CreatedAt:    now.UTC(),
	})
	if errors.Is(err, ErrEmailTaken) {
		// Hash was computed above, so both paths do the same expensive work
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}

	return userID, true, nil
}

// CreateVerificationToken generates a token for email verification.
func (s *Store) CreateVerificationToken(ctx context.Context, userID string, now time.Time) (string, error) {
	token, err := newVerificationToken()
	if err != nil {
		return "", err
	}

	err = s.records.InsertVerification(ctx, VerificationRecord{
		UserID:    userID,
		TokenHash: hashToken(token),
		ExpiresAt: now.UTC().Add(verificationTTL),
		CreatedAt: now.UTC(),
	})
	if err != nil {
		return "", err
	}

	return token, nil
}

// VerifyEmail marks an account as verified using a verification token.
func (s *Store) VerifyEmail(ctx context.Context, token string, now time.Time) error {
	if token == "" {
		return ErrInvalidToken
	}

	verification, err := s.records.TakeVerification(ctx, hashToken(token))
	if errors.Is(err, ErrNotFound) {
		return ErrInvalidToken
	}
	if err != nil {
		return err
	}

	if !verification.ExpiresAt.After(now) {
		return ErrInvalidToken
	}

	return s.records.SetVerified(ctx, verification.UserID)
}

// EmailSignin signs in with email and password.
func (s *Store) EmailSignin(ctx context.Context, email, password, audience string, now time.Time) (string, Session, error) {
	email = normalizeEmail(email)
	if email == "" || password == "" {
		return "", Session{}, ErrInvalidLogin
	}

	// Check for account lockout
	if err := s.checkLoginAttempts(ctx, email, now); err != nil {
		return "", Session{}, err
	}

	user, err := s.records.UserByEmail(ctx, email)
	if errors.Is(err, ErrNotFound) {
		s.recordFailedLogin(ctx, email, now)
		return "", Session{}, ErrInvalidLogin
	}
	if err != nil {
		return "", Session{}, err
	}

	if len(user.PasswordHash) == 0 || len(user.PasswordSalt) == 0 {
		s.recordFailedLogin(ctx, email, now)
		return "", Session{}, ErrInvalidLogin
	}

	if !verifyPassword(password, user.PasswordHash, user.PasswordSalt) {
		s.recordFailedLogin(ctx, email, now)
		return "", Session{}, ErrInvalidLogin
	}

	if !user.Verified {
		return "", Session{}, ErrEmailNotVerified
	}
	if s.userSuspended(user) {
		return "", Session{}, ErrSuspended
	}

	stored := storedUser{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role, CreatedAt: user.CreatedAt}
	if err := s.ensureRole(ctx, &stored); err != nil {
		return "", Session{}, err
	}
	if !AllowsAudience(audience, stored.Role) {
		return "", Session{}, &RoleError{Role: stored.Role}
	}

	// Clear login attempts on successful login
	s.clearLoginAttempts(ctx, email)

	return s.issue(ctx, stored.ID, now)
}

// RequestPasswordReset creates a password reset token for an email address.
func (s *Store) RequestPasswordReset(ctx context.Context, email string, now time.Time) (string, error) {
	email = normalizeEmail(email)
	if email == "" {
		return "", ErrInvalidInput
	}

	// Check if user exists (without revealing if email exists for security)
	_, err := s.records.UserByEmail(ctx, email)
	if errors.Is(err, ErrNotFound) {
		// Don't reveal that email doesn't exist, do equivalent dummy work to prevent timing attack
		_, _ = newResetToken()
		return "", nil
	}
	if err != nil {
		return "", err
	}

	token, err := newResetToken()
	if err != nil {
		return "", err
	}

	if err := s.records.DeleteResets(ctx, email); err != nil {
		return "", err
	}

	err = s.records.InsertReset(ctx, ResetRecord{
		Email:     email,
		TokenHash: hashToken(token),
		ExpiresAt: now.UTC().Add(resetTTL),
		CreatedAt: now.UTC(),
	})
	if err != nil {
		return "", err
	}

	return token, nil
}

// ResetPassword changes the password using a reset token.
func (s *Store) ResetPassword(ctx context.Context, token, newPassword string, now time.Time) error {
	if token == "" || newPassword == "" {
		return ErrInvalidInput
	}
	if len(newPassword) < 8 {
		return ErrWeakPassword
	}

	reset, err := s.records.TakeReset(ctx, hashToken(token))
	if errors.Is(err, ErrNotFound) {
		return ErrInvalidToken
	}
	if err != nil {
		return err
	}

	if !reset.ExpiresAt.After(now) {
		return ErrInvalidToken
	}

	passwordHash, passwordSalt, err := hashPassword(newPassword)
	if err != nil {
		return err
	}

	if err := s.records.SetPassword(ctx, reset.Email, passwordHash, passwordSalt); err != nil {
		return err
	}

	user, err := s.records.UserByEmail(ctx, reset.Email)
	if err == nil {
		_ = s.records.DeleteSessionsByUser(ctx, user.ID)
	}

	return nil
}

// checkLoginAttempts verifies if an account is locked due to too many failed attempts.
func (s *Store) checkLoginAttempts(ctx context.Context, email string, now time.Time) error {
	attempt, err := s.records.LoginAttempt(ctx, email)
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	// If lockout has expired, reset the counter
	if !attempt.LockedUntil.IsZero() && !attempt.LockedUntil.After(now) {
		_ = s.records.DeleteLoginAttempt(ctx, email)
		return nil
	}

	if !attempt.LockedUntil.IsZero() && attempt.LockedUntil.After(now) {
		return ErrAccountLocked
	}

	return nil
}

// recordFailedLogin increments failed login attempts and locks account if needed.
func (s *Store) recordFailedLogin(ctx context.Context, email string, now time.Time) {
	newAttempts := 1
	var lockedUntil time.Time

	if attempt, err := s.records.LoginAttempt(ctx, email); err == nil {
		newAttempts = attempt.Attempts + 1
	}

	if newAttempts >= maxLoginAttempts {
		lockedUntil = now.UTC().Add(loginLockoutTime)
	}

	_ = s.records.UpsertLoginAttempt(ctx, LoginAttemptRecord{
		Email:       email,
		Attempts:    newAttempts,
		LockedUntil: lockedUntil,
		UpdatedAt:   now.UTC(),
	})
}

// clearLoginAttempts removes failed login attempts after successful login.
func (s *Store) clearLoginAttempts(ctx context.Context, email string) {
	_ = s.records.DeleteLoginAttempt(ctx, email)
}

func (s *Store) ensureEmailIndexes(ctx context.Context) error {
	// Verification tokens index
	_, err := s.collection(verificationCollection).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "tokenHash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "userId", Value: 1}}},
		{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	})
	if err != nil {
		return err
	}

	// Password reset tokens index
	_, err = s.collection(resetCollection).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "tokenHash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "email", Value: 1}}},
		{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	})
	if err != nil {
		return err
	}

	// Login attempts index
	_, err = s.collection(loginAttemptsCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	return err
}

func newVerificationToken() (string, error) {
	raw := make([]byte, verificationTokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func newResetToken() (string, error) {
	raw := make([]byte, resetTokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func hashPassword(password string) ([]byte, []byte, error) {
	salt := make([]byte, saltBytes)
	if _, err := rand.Read(salt); err != nil {
		return nil, nil, err
	}

	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return hash, salt, nil
}

func verifyPassword(password string, hash, salt []byte) bool {
	computedHash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return subtle.ConstantTimeCompare(computedHash, hash) == 1
}

// DevEmailSender logs email messages instead of sending them.
type DevEmailSender struct{}

func (d DevEmailSender) SendVerification(ctx context.Context, to, name, token string) error {
	slog.Info("Email verification",
		"to", to,
		"name", name,
		"verificationLink", "http://localhost:3000/verify?token="+token,
	)
	return nil
}

func (d DevEmailSender) SendPasswordReset(ctx context.Context, to, name, token string) error {
	slog.Info("Password reset",
		"to", to,
		"name", name,
		"resetLink", "http://localhost:3000/reset-password?token="+token,
	)
	return nil
}

func (d DevEmailSender) SendDuplicateSignupNotice(ctx context.Context, to string) error {
	slog.Info("Duplicate signup attempt",
		"to", to,
		"message", "Someone tried to sign up with your email address. If this wasn't you, your account is safe.",
	)
	return nil
}
