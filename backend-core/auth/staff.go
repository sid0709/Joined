package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	staffSessionsCollection = "staff_sessions"
	// staffSessionLifetime is short: the staff console can change anything.
	staffSessionLifetime = 12 * time.Hour
)

// ErrNotStaff is a Google account outside the staff Workspace domain.
var ErrNotStaff = errors.New("this Google account is not a staff account")

// Staff is someone signed in to the staff console. Staff are not Joined accounts:
// their Google Workspace account is the identity, and nothing is stored but sessions.
type Staff struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type storedStaffSession struct {
	TokenHash string    `bson:"tokenHash"`
	Subject   string    `bson:"subject"`
	Email     string    `bson:"email"`
	Name      string    `bson:"name"`
	CreatedAt time.Time `bson:"createdAt"`
	ExpiresAt time.Time `bson:"expiresAt"`
}

// StaffSignin starts a staff session for a verified Google identity managed by
// domain. hostedDomain is the Workspace domain Google reported for the account.
func (s *Store) StaffSignin(ctx context.Context, id GoogleIdentity, hostedDomain, domain string, now time.Time) (string, Staff, error) {
	email := normalizeEmail(id.Email)
	if id.Subject == "" || email == "" || !id.EmailVerified {
		return "", Staff{}, ErrInvalidInput
	}
	if !IsStaffDomain(email, hostedDomain, domain) {
		return "", Staff{}, ErrNotStaff
	}
	token, hash, err := newToken()
	if err != nil {
		return "", Staff{}, err
	}
	staff := Staff{Email: email, Name: strings.TrimSpace(id.Name)}
	_, err = s.collection(staffSessionsCollection).InsertOne(ctx, storedStaffSession{
		TokenHash: hash,
		Subject:   id.Subject,
		Email:     staff.Email,
		Name:      staff.Name,
		CreatedAt: now.UTC(),
		ExpiresAt: now.UTC().Add(staffSessionLifetime),
	})
	if err != nil {
		return "", Staff{}, err
	}
	return token, staff, nil
}

// StaffSession is who holds token, or ErrInvalidLogin when it is unknown or expired.
func (s *Store) StaffSession(ctx context.Context, token string, now time.Time) (Staff, error) {
	if token == "" {
		return Staff{}, ErrInvalidLogin
	}
	var record storedStaffSession
	err := s.collection(staffSessionsCollection).FindOne(ctx, bson.D{{Key: "tokenHash", Value: hashToken(token)}}).Decode(&record)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Staff{}, ErrInvalidLogin
	}
	if err != nil {
		return Staff{}, err
	}
	if !record.ExpiresAt.After(now) {
		return Staff{}, ErrInvalidLogin
	}
	return Staff{Email: record.Email, Name: record.Name}, nil
}

// StaffSignout ends token's session. An unknown token is already signed out.
func (s *Store) StaffSignout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	_, err := s.collection(staffSessionsCollection).DeleteOne(ctx, bson.D{{Key: "tokenHash", Value: hashToken(token)}})
	return err
}

// IsStaffDomain reports whether a Google account belongs to the staff Workspace:
// Google says domain manages it, and the email is on that domain. A blank domain
// lets nobody in.
func IsStaffDomain(email, hostedDomain, domain string) bool {
	domain = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(domain), "@"))
	if domain == "" {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(hostedDomain), domain) &&
		strings.HasSuffix(normalizeEmail(email), "@"+domain)
}

func (s *Store) ensureStaffIndexes(ctx context.Context) error {
	_, err := s.collection(staffSessionsCollection).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "tokenHash", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "expiresAt", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(0),
		},
	})
	return err
}
