package auth

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// auditStaffSubject marks staff sessions minted for local audits, so they are easy to find and remove.
const auditStaffSubject = "local-audit"

var (
	// ErrNoAuditUser means no account has the audit user id.
	ErrNoAuditUser = errors.New("no account has that audit user id")
	// ErrAuditUserMismatch means the audit user id and email belong to different accounts.
	ErrAuditUserMismatch = errors.New("audit user id and email do not match the same account")
)

// IssueAuditSession signs in as one pinned test account for a Lighthouse audit.
// Both userID and email must name the same account, so a typo never signs in as someone else.
// The session lives for ttl only; callers revoke it with Signout when the audit ends.
func (s *Store) IssueAuditSession(ctx context.Context, userID, email string, ttl time.Duration, now time.Time) (string, User, error) {
	if userID == "" || normalizeEmail(email) == "" {
		return "", User{}, ErrInvalidInput
	}
	user, err := s.records.UserByID(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		return "", User{}, ErrNoAuditUser
	}
	if err != nil {
		return "", User{}, fmt.Errorf("find audit user: %w", err)
	}
	if normalizeEmail(user.Email) != normalizeEmail(email) {
		return "", User{}, ErrAuditUserMismatch
	}
	token, hash, err := newToken()
	if err != nil {
		return "", User{}, err
	}
	err = s.records.InsertSession(ctx, SessionRecord{
		TokenHash: hash,
		UserID:    user.ID,
		CreatedAt: now.UTC(),
		ExpiresAt: now.UTC().Add(ttl),
	})
	if err != nil {
		return "", User{}, fmt.Errorf("insert audit session: %w", err)
	}
	return token, User{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role}, nil
}

// IssueAuditStaffSession opens the staff console for a local Lighthouse audit, for ttl only.
func (s *Store) IssueAuditStaffSession(ctx context.Context, email string, ttl time.Duration, now time.Time) (string, error) {
	token, hash, err := newToken()
	if err != nil {
		return "", err
	}
	_, err = s.collection(staffSessionsCollection).InsertOne(ctx, storedStaffSession{
		TokenHash: hash,
		Subject:   auditStaffSubject,
		Email:     normalizeEmail(email),
		Name:      auditStaffSubject,
		CreatedAt: now.UTC(),
		ExpiresAt: now.UTC().Add(ttl),
	})
	if err != nil {
		return "", fmt.Errorf("insert audit staff session: %w", err)
	}
	return token, nil
}
