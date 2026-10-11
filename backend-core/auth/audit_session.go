package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// auditStaffSubject marks staff sessions minted for local audits, so they are easy to find and remove.
const auditStaffSubject = "local-audit"

// ErrNoAuditUser means no account with the requested role exists to audit as.
var ErrNoAuditUser = errors.New("no account with that role to audit as")

// IssueAuditSession signs in as the first account with role, for a local Lighthouse audit.
// The session lives for ttl only; callers revoke it with Signout when the audit ends.
func (s *Store) IssueAuditSession(ctx context.Context, role string, ttl time.Duration, now time.Time) (string, User, error) {
	var user storedUser
	err := s.collection(usersCollection).FindOne(ctx, bson.D{{Key: "role", Value: role}}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", User{}, ErrNoAuditUser
	}
	if err != nil {
		return "", User{}, fmt.Errorf("find audit user: %w", err)
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
