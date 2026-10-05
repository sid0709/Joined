package auth

import (
	"context"
	"strings"
	"sync"
	"time"
)

// AuthStore is the interface for authentication storage operations.
// Implemented by Store (MongoDB-backed) and memStore (in-memory for tests).
type AuthStore interface {
	EmailSignup(ctx context.Context, email, password, name, role string, now time.Time) (string, bool, error)
	CreateVerificationToken(ctx context.Context, userID string, now time.Time) (string, error)
	VerifyEmail(ctx context.Context, token string, now time.Time) error
	EmailSignin(ctx context.Context, email, password, audience string, now time.Time) (string, Session, error)
	RequestPasswordReset(ctx context.Context, email string, now time.Time) (string, error)
	ResetPassword(ctx context.Context, token, newPassword string, now time.Time) error
}

// memStore is an in-memory implementation of AuthStore for testing without MongoDB.
type memStore struct {
	mu                 sync.Mutex
	users              map[string]*memUser
	usersByEmail       map[string]*memUser
	verifications      map[string]*memVerification
	resets             map[string]*memReset
	sessions           map[string]*memSession
	loginAttempts      map[string]*memLoginAttempt
	passwordHasher     func(password string) ([]byte, []byte, error)
	nextTokenCallCount int
}

type memUser struct {
	id           string
	name         string
	email        string
	role         string
	passwordHash []byte
	passwordSalt []byte
	verified     bool
	createdAt    time.Time
}

type memVerification struct {
	userID    string
	tokenHash string
	expiresAt time.Time
}

type memReset struct {
	email     string
	tokenHash string
	expiresAt time.Time
}

type memSession struct {
	userID    string
	expiresAt time.Time
}

type memLoginAttempt struct {
	attempts    int
	lockedUntil time.Time
	updatedAt   time.Time
}

// NewMemStore creates an in-memory AuthStore implementation for testing.
func NewMemStore() AuthStore {
	return &memStore{
		users:          make(map[string]*memUser),
		usersByEmail:   make(map[string]*memUser),
		verifications:  make(map[string]*memVerification),
		resets:         make(map[string]*memReset),
		sessions:       make(map[string]*memSession),
		loginAttempts:  make(map[string]*memLoginAttempt),
		passwordHasher: hashPassword,
	}
}

func (m *memStore) EmailSignup(ctx context.Context, email, password, name, role string, now time.Time) (string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

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

	passwordHash, passwordSalt, err := m.passwordHasher(password)
	if err != nil {
		return "", false, err
	}

	if _, exists := m.usersByEmail[email]; exists {
		return "", false, nil
	}

	userID, err := newPublicID()
	if err != nil {
		return "", false, err
	}

	user := &memUser{
		id:           userID,
		name:         name,
		email:        email,
		role:         role,
		passwordHash: passwordHash,
		passwordSalt: passwordSalt,
		verified:     false,
		createdAt:    now,
	}

	m.users[userID] = user
	m.usersByEmail[email] = user

	return userID, true, nil
}

func (m *memStore) CreateVerificationToken(ctx context.Context, userID string, now time.Time) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.users[userID]; !exists {
		return "", ErrNotFound
	}

	token, err := newVerificationToken()
	if err != nil {
		return "", err
	}

	m.verifications[hashToken(token)] = &memVerification{
		userID:    userID,
		tokenHash: hashToken(token),
		expiresAt: now.Add(verificationTTL),
	}

	return token, nil
}

func (m *memStore) VerifyEmail(ctx context.Context, token string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if token == "" {
		return ErrInvalidToken
	}

	tokenHash := hashToken(token)
	verification, exists := m.verifications[tokenHash]
	if !exists {
		return ErrInvalidToken
	}

	if !verification.expiresAt.After(now) {
		return ErrInvalidToken
	}

	user, exists := m.users[verification.userID]
	if !exists {
		return ErrNotFound
	}

	user.verified = true
	delete(m.verifications, tokenHash)

	return nil
}

func (m *memStore) EmailSignin(ctx context.Context, email, password, audience string, now time.Time) (string, Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	email = normalizeEmail(email)
	if email == "" || password == "" {
		return "", Session{}, ErrInvalidLogin
	}

	if err := m.checkLoginAttemptsLocked(email, now); err != nil {
		return "", Session{}, err
	}

	user, exists := m.usersByEmail[email]
	if !exists || len(user.passwordHash) == 0 || len(user.passwordSalt) == 0 {
		m.recordFailedLoginLocked(email, now)
		return "", Session{}, ErrInvalidLogin
	}

	if !verifyPassword(password, user.passwordHash, user.passwordSalt) {
		m.recordFailedLoginLocked(email, now)
		return "", Session{}, ErrInvalidLogin
	}

	if !user.verified {
		return "", Session{}, ErrEmailNotVerified
	}

	if !AllowsAudience(audience, user.role) {
		return "", Session{}, &RoleError{Role: user.role}
	}

	delete(m.loginAttempts, email)

	token, tokenHash, err := newToken()
	if err != nil {
		return "", Session{}, err
	}

	m.sessions[tokenHash] = &memSession{
		userID:    user.id,
		expiresAt: now.Add(sessionLifetime),
	}

	return token, Session{
		User: User{
			ID:    user.id,
			Name:  user.name,
			Email: user.email,
			Role:  user.role,
		},
	}, nil
}

func (m *memStore) RequestPasswordReset(ctx context.Context, email string, now time.Time) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	email = normalizeEmail(email)
	if email == "" {
		return "", ErrInvalidInput
	}

	_, exists := m.usersByEmail[email]
	if !exists {
		_, _ = newResetToken()
		return "", nil
	}

	token, err := newResetToken()
	if err != nil {
		return "", err
	}

	tokenHash := hashToken(token)
	m.resets[tokenHash] = &memReset{
		email:     email,
		tokenHash: tokenHash,
		expiresAt: now.Add(resetTTL),
	}

	return token, nil
}

func (m *memStore) ResetPassword(ctx context.Context, token, newPassword string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if token == "" || newPassword == "" {
		return ErrInvalidInput
	}
	if len(newPassword) < 8 {
		return ErrWeakPassword
	}

	tokenHash := hashToken(token)
	reset, exists := m.resets[tokenHash]
	if !exists {
		return ErrInvalidToken
	}

	if !reset.expiresAt.After(now) {
		return ErrInvalidToken
	}

	user, exists := m.usersByEmail[reset.email]
	if !exists {
		return ErrNotFound
	}

	passwordHash, passwordSalt, err := hashPassword(newPassword)
	if err != nil {
		return err
	}

	user.passwordHash = passwordHash
	user.passwordSalt = passwordSalt

	delete(m.resets, tokenHash)

	return nil
}

func (m *memStore) checkLoginAttemptsLocked(email string, now time.Time) error {
	attempt, exists := m.loginAttempts[email]
	if !exists {
		return nil
	}

	if !attempt.lockedUntil.IsZero() && !attempt.lockedUntil.After(now) {
		delete(m.loginAttempts, email)
		return nil
	}

	if !attempt.lockedUntil.IsZero() && attempt.lockedUntil.After(now) {
		return ErrAccountLocked
	}

	return nil
}

func (m *memStore) recordFailedLoginLocked(email string, now time.Time) {
	attempt, exists := m.loginAttempts[email]
	if !exists {
		attempt = &memLoginAttempt{}
		m.loginAttempts[email] = attempt
	}

	attempt.attempts++
	attempt.updatedAt = now

	if attempt.attempts >= maxLoginAttempts {
		attempt.lockedUntil = now.Add(loginLockoutTime)
	}
}
