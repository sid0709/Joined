// Package authtest builds an auth.Store on an in-memory AccountRecords.
// It stores rows only. Hashing, lockout, and expiry stay on auth.Store.
package authtest

import (
	"context"
	"sync"

	"github.com/sid0709/OpenSeat/backend-core/auth"
)

type records struct {
	mu            sync.Mutex
	users         map[string]auth.AccountUser
	usersByEmail  map[string]string
	verifications map[string]auth.VerificationRecord
	resets        map[string]auth.ResetRecord
	attempts      map[string]auth.LoginAttemptRecord
	sessions      map[string]auth.SessionRecord
}

var _ auth.AccountRecords = (*records)(nil)

func newRecords() *records {
	return &records{
		users:         make(map[string]auth.AccountUser),
		usersByEmail:  make(map[string]string),
		verifications: make(map[string]auth.VerificationRecord),
		resets:        make(map[string]auth.ResetRecord),
		attempts:      make(map[string]auth.LoginAttemptRecord),
		sessions:      make(map[string]auth.SessionRecord),
	}
}

// NewStore returns a Store that runs real auth logic on in-memory records.
func NewStore() *auth.Store {
	return auth.NewStoreOn(newRecords())
}

func (r *records) InsertUser(ctx context.Context, user auth.AccountUser) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.usersByEmail[user.Email]; exists {
		return auth.ErrEmailTaken
	}
	r.users[user.ID] = user
	r.usersByEmail[user.Email] = user.ID
	return nil
}

func (r *records) UserByEmail(ctx context.Context, email string) (auth.AccountUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	id, ok := r.usersByEmail[email]
	if !ok {
		return auth.AccountUser{}, auth.ErrNotFound
	}
	return r.users[id], nil
}

func (r *records) UserByID(ctx context.Context, id string) (auth.AccountUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	user, ok := r.users[id]
	if !ok {
		return auth.AccountUser{}, auth.ErrNotFound
	}
	return user, nil
}

func (r *records) SetVerified(ctx context.Context, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	user, ok := r.users[userID]
	if !ok {
		return auth.ErrNotFound
	}
	user.Verified = true
	r.users[userID] = user
	return nil
}

func (r *records) SetPassword(ctx context.Context, email string, hash, salt []byte) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	id, ok := r.usersByEmail[email]
	if !ok {
		return auth.ErrNotFound
	}
	user := r.users[id]
	user.PasswordHash = hash
	user.PasswordSalt = salt
	r.users[id] = user
	return nil
}

func (r *records) InsertVerification(ctx context.Context, rec auth.VerificationRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.verifications[rec.TokenHash] = rec
	return nil
}

func (r *records) TakeVerification(ctx context.Context, tokenHash string) (auth.VerificationRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.verifications[tokenHash]
	if !ok {
		return auth.VerificationRecord{}, auth.ErrNotFound
	}
	delete(r.verifications, tokenHash)
	return rec, nil
}

func (r *records) DeleteResets(ctx context.Context, email string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for hash, rec := range r.resets {
		if rec.Email == email {
			delete(r.resets, hash)
		}
	}
	return nil
}

func (r *records) InsertReset(ctx context.Context, rec auth.ResetRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.resets[rec.TokenHash] = rec
	return nil
}

func (r *records) TakeReset(ctx context.Context, tokenHash string) (auth.ResetRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.resets[tokenHash]
	if !ok {
		return auth.ResetRecord{}, auth.ErrNotFound
	}
	delete(r.resets, tokenHash)
	return rec, nil
}

func (r *records) LoginAttempt(ctx context.Context, email string) (auth.LoginAttemptRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.attempts[email]
	if !ok {
		return auth.LoginAttemptRecord{}, auth.ErrNotFound
	}
	return rec, nil
}

func (r *records) UpsertLoginAttempt(ctx context.Context, rec auth.LoginAttemptRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.attempts[rec.Email] = rec
	return nil
}

func (r *records) DeleteLoginAttempt(ctx context.Context, email string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.attempts, email)
	return nil
}

func (r *records) InsertSession(ctx context.Context, rec auth.SessionRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sessions[rec.TokenHash] = rec
	return nil
}

func (r *records) DeleteSessionsByUser(ctx context.Context, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for hash, rec := range r.sessions {
		if rec.UserID == userID {
			delete(r.sessions, hash)
		}
	}
	return nil
}

func (r *records) SessionByToken(ctx context.Context, tokenHash string) (auth.SessionRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.sessions[tokenHash]
	if !ok {
		return auth.SessionRecord{}, auth.ErrNotFound
	}
	return rec, nil
}

func (r *records) DeleteUser(ctx context.Context, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	user, ok := r.users[userID]
	if !ok {
		return auth.ErrNotFound
	}
	delete(r.users, userID)
	delete(r.usersByEmail, user.Email)
	return nil
}

func (r *records) CompanyMembership(ctx context.Context, userID string) (*auth.Company, error) {
	return nil, auth.ErrNotFound
}
