package auth

import (
	"context"
	"sync"
)

// memAccountRecords is a test-only in-memory AccountRecords.
// It stores rows only. Hashing, lockout, and expiry stay on Store.
type memAccountRecords struct {
	mu            sync.Mutex
	users         map[string]AccountUser
	usersByEmail  map[string]string
	verifications map[string]VerificationRecord
	resets        map[string]ResetRecord
	attempts      map[string]LoginAttemptRecord
	sessions      map[string]SessionRecord
}

var _ AccountRecords = (*memAccountRecords)(nil)

func newMemAccountRecords() *memAccountRecords {
	return &memAccountRecords{
		users:         make(map[string]AccountUser),
		usersByEmail:  make(map[string]string),
		verifications: make(map[string]VerificationRecord),
		resets:        make(map[string]ResetRecord),
		attempts:      make(map[string]LoginAttemptRecord),
		sessions:      make(map[string]SessionRecord),
	}
}

// NewTestStore returns a Store that runs real auth logic on an in-memory
// repository. For tests only.
func NewTestStore() *Store {
	return NewStoreOn(newMemAccountRecords())
}

func (m *memAccountRecords) hasVerification(tokenHash string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.verifications[tokenHash]
	return ok
}

func (m *memAccountRecords) hasReset(tokenHash string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.resets[tokenHash]
	return ok
}

func (m *memAccountRecords) verified(userID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	user, ok := m.users[userID]
	return ok && user.Verified
}

func (m *memAccountRecords) InsertUser(ctx context.Context, user AccountUser) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.usersByEmail[user.Email]; exists {
		return ErrEmailTaken
	}
	m.users[user.ID] = user
	m.usersByEmail[user.Email] = user.ID
	return nil
}

func (m *memAccountRecords) UserByEmail(ctx context.Context, email string) (AccountUser, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.usersByEmail[email]
	if !ok {
		return AccountUser{}, ErrNotFound
	}
	return m.users[id], nil
}

func (m *memAccountRecords) UserByID(ctx context.Context, id string) (AccountUser, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	user, ok := m.users[id]
	if !ok {
		return AccountUser{}, ErrNotFound
	}
	return user, nil
}

func (m *memAccountRecords) SetVerified(ctx context.Context, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	user, ok := m.users[userID]
	if !ok {
		return ErrNotFound
	}
	user.Verified = true
	m.users[userID] = user
	return nil
}

func (m *memAccountRecords) SetPassword(ctx context.Context, email string, hash, salt []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.usersByEmail[email]
	if !ok {
		return ErrNotFound
	}
	user := m.users[id]
	user.PasswordHash = hash
	user.PasswordSalt = salt
	m.users[id] = user
	return nil
}

func (m *memAccountRecords) InsertVerification(ctx context.Context, rec VerificationRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.verifications[rec.TokenHash] = rec
	return nil
}

func (m *memAccountRecords) TakeVerification(ctx context.Context, tokenHash string) (VerificationRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.verifications[tokenHash]
	if !ok {
		return VerificationRecord{}, ErrNotFound
	}
	delete(m.verifications, tokenHash)
	return rec, nil
}

func (m *memAccountRecords) DeleteResets(ctx context.Context, email string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for hash, rec := range m.resets {
		if rec.Email == email {
			delete(m.resets, hash)
		}
	}
	return nil
}

func (m *memAccountRecords) InsertReset(ctx context.Context, rec ResetRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resets[rec.TokenHash] = rec
	return nil
}

func (m *memAccountRecords) TakeReset(ctx context.Context, tokenHash string) (ResetRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.resets[tokenHash]
	if !ok {
		return ResetRecord{}, ErrNotFound
	}
	delete(m.resets, tokenHash)
	return rec, nil
}

func (m *memAccountRecords) LoginAttempt(ctx context.Context, email string) (LoginAttemptRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.attempts[email]
	if !ok {
		return LoginAttemptRecord{}, ErrNotFound
	}
	return rec, nil
}

func (m *memAccountRecords) UpsertLoginAttempt(ctx context.Context, rec LoginAttemptRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.attempts[rec.Email] = rec
	return nil
}

func (m *memAccountRecords) DeleteLoginAttempt(ctx context.Context, email string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.attempts, email)
	return nil
}

func (m *memAccountRecords) InsertSession(ctx context.Context, rec SessionRecord) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[rec.TokenHash] = rec
	return nil
}

func (m *memAccountRecords) DeleteSessionsByUser(ctx context.Context, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for hash, rec := range m.sessions {
		if rec.UserID == userID {
			delete(m.sessions, hash)
		}
	}
	return nil
}
