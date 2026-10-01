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
	googleStatesCollection = "google_signin_states"
	// googleStateTTL is how long someone has to finish on Google's consent screen.
	googleStateTTL = 10 * time.Minute
)

var (
	ErrGoogleState    = errors.New("the Google sign-in expired; try again")
	ErrGoogleMismatch = errors.New("this email is linked to a different Google account")
)

// GoogleIdentity is who Google says signed in.
type GoogleIdentity struct {
	// Subject is the account's stable Google ID.
	Subject       string
	Email         string
	EmailVerified bool
	Name          string
}

type storedGoogleState struct {
	State     string    `bson:"state"`
	Verifier  string    `bson:"verifier"`
	ExpiresAt time.Time `bson:"expiresAt"`
}

// SaveGoogleState remembers a sign-in in progress and its PKCE verifier.
func (s *Store) SaveGoogleState(ctx context.Context, state, verifier string, now time.Time) error {
	_, err := s.collection(googleStatesCollection).InsertOne(ctx, storedGoogleState{
		State:     state,
		Verifier:  verifier,
		ExpiresAt: now.UTC().Add(googleStateTTL),
	})
	return err
}

// TakeGoogleState returns the verifier for state and forgets the state, so a
// redirect can be used once.
func (s *Store) TakeGoogleState(ctx context.Context, state string, now time.Time) (string, error) {
	if state == "" {
		return "", ErrGoogleState
	}
	var record storedGoogleState
	err := s.collection(googleStatesCollection).FindOneAndDelete(ctx, bson.D{{Key: "state", Value: state}}).Decode(&record)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", ErrGoogleState
	}
	if err != nil {
		return "", err
	}
	if !record.ExpiresAt.After(now) {
		return "", ErrGoogleState
	}
	return record.Verifier, nil
}

// GoogleSignin signs in the account behind a verified Google identity. Without
// one, it creates an account of role with no password. An account that exists
// must already have role: each app only signs in its own kind of account.
func (s *Store) GoogleSignin(ctx context.Context, id GoogleIdentity, role string, now time.Time) (string, Session, error) {
	email := normalizeEmail(id.Email)
	if id.Subject == "" || email == "" || !id.EmailVerified {
		return "", Session{}, ErrInvalidInput
	}
	user, err := s.googleUser(ctx, id.Subject, email)
	if errors.Is(err, ErrNotFound) {
		userID, err := s.createGoogleUser(ctx, id, email, role, now)
		if err != nil {
			return "", Session{}, err
		}
		return s.issue(ctx, userID, now)
	}
	if err != nil {
		return "", Session{}, err
	}
	if err := s.ensureRole(ctx, &user); err != nil {
		return "", Session{}, err
	}
	link, err := googleAccess(user, id.Subject, role)
	if err != nil {
		return "", Session{}, err
	}
	if link {
		if err := s.linkGoogle(ctx, user.ID, id.Subject); err != nil {
			return "", Session{}, err
		}
	}
	return s.issue(ctx, user.ID, now)
}

// googleAccess decides whether a Google identity may sign in to user, and
// whether that sign-in links the Google account for the first time.
func googleAccess(user storedUser, subject, role string) (bool, error) {
	if user.Role != role {
		return false, &RoleError{Role: user.Role}
	}
	switch user.GoogleID {
	case subject:
		return false, nil
	case "":
		return true, nil
	default:
		return false, ErrGoogleMismatch
	}
}

// googleUser finds the account by Google ID first, since the Google email can
// change, then by email.
func (s *Store) googleUser(ctx context.Context, subject, email string) (storedUser, error) {
	for _, filter := range []bson.D{
		{{Key: "googleId", Value: subject}},
		{{Key: "email", Value: email}},
	} {
		var user storedUser
		err := s.collection(usersCollection).FindOne(ctx, filter).Decode(&user)
		if err == nil {
			return user, nil
		}
		if !errors.Is(err, mongo.ErrNoDocuments) {
			return storedUser{}, err
		}
	}
	return storedUser{}, ErrNotFound
}

func (s *Store) createGoogleUser(ctx context.Context, id GoogleIdentity, email, role string, now time.Time) (string, error) {
	userID, err := newPublicID()
	if err != nil {
		return "", err
	}
	_, err = s.collection(usersCollection).InsertOne(ctx, storedUser{
		ID:        userID,
		Name:      googleName(id.Name, email),
		Email:     email,
		Role:      role,
		GoogleID:  id.Subject,
		CreatedAt: now.UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		return "", ErrEmailTaken
	}
	return userID, err
}

// linkGoogle ties an existing account to the Google account that proved it owns
// the email, and ends the account's other sessions: whoever held them may not
// own that email.
func (s *Store) linkGoogle(ctx context.Context, userID, subject string) error {
	result, err := s.collection(usersCollection).UpdateOne(ctx, bson.D{
		{Key: "id", Value: userID},
		{Key: "googleId", Value: bson.D{{Key: "$exists", Value: false}}},
	}, bson.D{{Key: "$set", Value: bson.D{{Key: "googleId", Value: subject}}}})
	if mongo.IsDuplicateKeyError(err) {
		return ErrGoogleMismatch
	}
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrGoogleMismatch
	}
	_, err = s.collection(sessionsCollection).DeleteMany(ctx, bson.D{{Key: "userId", Value: userID}})
	return err
}

// googleName is the account name for a new Google sign-in: the Google profile
// name, or the email's local part when Google has none.
func googleName(name, email string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		name, _, _ = strings.Cut(email, "@")
	}
	if runes := []rune(name); len(runes) > maxNameLength {
		name = string(runes[:maxNameLength])
	}
	return name
}

func (s *Store) ensureGoogleIndexes(ctx context.Context) error {
	_, err := s.collection(usersCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "googleId", Value: 1}},
		Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.D{
			{Key: "googleId", Value: bson.D{{Key: "$type", Value: "string"}}},
		}),
	})
	if err != nil {
		return err
	}
	_, err = s.collection(googleStatesCollection).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "state", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	})
	return err
}
