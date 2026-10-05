// Package account is Acorn's own accounts. acorn-frontend and the extension share
// these sessions. Joined accounts are a different service and are not accepted here.
package account

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	accountsCollection = "acorn_accounts"
	sessionsCollection = "acorn_sessions"

	// SessionTTL is how long a sign-in stays valid. acorn-frontend keeps the cookie for the same span.
	SessionTTL = 30 * 24 * time.Hour

	minPasswordLength = 8
	maxNameLength     = 80
	maxEmailLength    = 254
)

var (
	// ErrInvalidLogin is a wrong email or password, or a session token Acorn does not know.
	ErrInvalidLogin = errors.New("email or password is incorrect")
	// ErrEmailTaken is a sign-up for an email that already has an Acorn account.
	ErrEmailTaken = errors.New("an account with that email already exists")
	// ErrWeakPassword is a password shorter than minPasswordLength.
	ErrWeakPassword = errors.New("password must be at least 8 characters")
	// ErrInvalid is a name, email, or job id Acorn will not store.
	ErrInvalid = errors.New("check the name, email, and password")
	// ErrAlreadyApplied is a job this account already marked applied.
	ErrAlreadyApplied = errors.New("already applied")
	// ErrGoogleState is a Google sign-in that expired or was already used.
	ErrGoogleState = errors.New("the Google sign-in expired; try again")
	// ErrGoogleMismatch is a Google account that is not the one linked to this email.
	ErrGoogleMismatch = errors.New("this email is linked to a different Google account")
)

// User is one Acorn account.
type User struct {
	ID    string
	Name  string
	Email string
}

// Session is a live sign-in.
type Session struct {
	User User
}

type storedAccount struct {
	ID           string    `bson:"id"`
	Name         string    `bson:"name"`
	Email        string    `bson:"email"`
	PasswordHash []byte    `bson:"passwordHash,omitempty"`
	PasswordSalt []byte    `bson:"passwordSalt,omitempty"`
	GoogleID     string    `bson:"googleId,omitempty"`
	SavedJobIDs  []string  `bson:"savedJobIds,omitempty"`
	AppliedIDs   []string  `bson:"appliedJobIds,omitempty"`
	CreatedAt    time.Time `bson:"createdAt"`
}

type storedSession struct {
	TokenHash string    `bson:"tokenHash"`
	UserID    string    `bson:"userId"`
	ExpiresAt time.Time `bson:"expiresAt"`
	CreatedAt time.Time `bson:"createdAt"`
}

// Store keeps Acorn accounts and sessions in their own collections.
type Store struct {
	accounts     *mongo.Collection
	sessions     *mongo.Collection
	googleStates *mongo.Collection
}

func NewStore(client *mongo.Client, database string) *Store {
	db := client.Database(database)
	return &Store{
		accounts:     db.Collection(accountsCollection),
		sessions:     db.Collection(sessionsCollection),
		googleStates: db.Collection(googleStatesCollection),
	}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	_, err := s.accounts.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}
	_, err = s.sessions.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "tokenHash", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}
	_, err = s.sessions.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "expiresAt", Value: 1}},
		Options: options.Index().SetExpireAfterSeconds(0),
	})
	if err != nil {
		return err
	}
	_, err = s.accounts.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "googleId", Value: 1}},
		Options: options.Index().SetUnique(true).SetSparse(true),
	})
	if err != nil {
		return err
	}
	_, err = s.googleStates.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "state", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}
	_, err = s.googleStates.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "expiresAt", Value: 1}},
		Options: options.Index().SetExpireAfterSeconds(0),
	})
	return err
}

// SignUp creates an account and a session. The returned token is the cookie value.
func (s *Store) SignUp(ctx context.Context, name, email, password string, now time.Time) (string, User, error) {
	user, hash, salt, err := newAccount(name, email, password)
	if err != nil {
		return "", User{}, err
	}
	_, err = s.accounts.InsertOne(ctx, storedAccount{
		ID: user.ID, Name: user.Name, Email: user.Email,
		PasswordHash: hash, PasswordSalt: salt, CreatedAt: now.UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		return "", User{}, ErrEmailTaken
	}
	if err != nil {
		return "", User{}, err
	}
	token, err := s.insertSession(ctx, user.ID, now)
	if err != nil {
		return "", User{}, err
	}
	return token, user, nil
}

// SignIn checks the password and opens a session.
func (s *Store) SignIn(ctx context.Context, email, password string, now time.Time) (string, User, error) {
	email = normalizeEmail(email)
	var doc storedAccount
	err := s.accounts.FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", User{}, ErrInvalidLogin
	}
	if err != nil {
		return "", User{}, err
	}
	if !passwordMatches(password, doc.PasswordHash, doc.PasswordSalt) {
		return "", User{}, ErrInvalidLogin
	}
	token, err := s.insertSession(ctx, doc.ID, now)
	if err != nil {
		return "", User{}, err
	}
	return token, User{ID: doc.ID, Name: doc.Name, Email: doc.Email}, nil
}

// Session resolves a bearer token or the acorn_session cookie.
func (s *Store) Session(ctx context.Context, token string, now time.Time) (Session, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return Session{}, ErrInvalidLogin
	}
	var doc storedSession
	err := s.sessions.FindOne(ctx, bson.D{{Key: "tokenHash", Value: hashToken(token)}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) || !doc.ExpiresAt.After(now) {
		return Session{}, ErrInvalidLogin
	}
	if err != nil {
		return Session{}, err
	}
	var user storedAccount
	err = s.accounts.FindOne(ctx, bson.D{{Key: "id", Value: doc.UserID}}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Session{}, ErrInvalidLogin
	}
	if err != nil {
		return Session{}, err
	}
	return Session{User: User{ID: user.ID, Name: user.Name, Email: user.Email}}, nil
}

// Revoke ends the session behind token. A missing token is still success.
func (s *Store) Revoke(ctx context.Context, token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil
	}
	_, err := s.sessions.DeleteOne(ctx, bson.D{{Key: "tokenHash", Value: hashToken(token)}})
	return err
}

func (s *Store) SavedJobIDs(ctx context.Context, userID string) ([]string, error) {
	return s.jobIDs(ctx, userID, "savedJobIds")
}

func (s *Store) AppliedJobIDs(ctx context.Context, userID string) ([]string, error) {
	return s.jobIDs(ctx, userID, "appliedJobIds")
}

// MarkApplied records a job on this Acorn account. It does not write to Joined.
func (s *Store) MarkApplied(ctx context.Context, userID, jobID string) error {
	jobID = strings.TrimSpace(jobID)
	if jobID == "" {
		return ErrInvalid
	}
	applied, err := s.AppliedJobIDs(ctx, userID)
	if err != nil {
		return err
	}
	for _, id := range applied {
		if id == jobID {
			return ErrAlreadyApplied
		}
	}
	_, err = s.accounts.UpdateOne(ctx, bson.D{{Key: "id", Value: userID}}, bson.D{
		{Key: "$addToSet", Value: bson.D{{Key: "appliedJobIds", Value: jobID}}},
		{Key: "$pull", Value: bson.D{{Key: "savedJobIds", Value: jobID}}},
	})
	return err
}

func (s *Store) jobIDs(ctx context.Context, userID, field string) ([]string, error) {
	var doc storedAccount
	err := s.accounts.FindOne(ctx, bson.D{{Key: "id", Value: userID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrInvalidLogin
	}
	if err != nil {
		return nil, err
	}
	if field == "appliedJobIds" {
		return doc.AppliedIDs, nil
	}
	return doc.SavedJobIDs, nil
}

func (s *Store) insertSession(ctx context.Context, userID string, now time.Time) (string, error) {
	token, err := newToken()
	if err != nil {
		return "", err
	}
	_, err = s.sessions.InsertOne(ctx, storedSession{
		TokenHash: hashToken(token),
		UserID:    userID,
		ExpiresAt: now.Add(SessionTTL).UTC(),
		CreatedAt: now.UTC(),
	})
	if err != nil {
		return "", err
	}
	return token, nil
}

func newAccount(name, email, password string) (User, []byte, []byte, error) {
	name = strings.TrimSpace(name)
	email = normalizeEmail(email)
	if name == "" || len(name) > maxNameLength || email == "" || len(email) > maxEmailLength || !strings.Contains(email, "@") {
		return User{}, nil, nil, ErrInvalid
	}
	if len(password) < minPasswordLength {
		return User{}, nil, nil, ErrWeakPassword
	}
	id, err := newID()
	if err != nil {
		return User{}, nil, nil, err
	}
	hash, salt, err := hashPassword(password)
	if err != nil {
		return User{}, nil, nil, err
	}
	return User{ID: id, Name: name, Email: email}, hash, salt, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
