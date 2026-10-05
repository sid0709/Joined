package account

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

const (
	googleStatesCollection = "acorn_google_states"
	// googleStateTTL is how long someone has to finish on Google's consent screen.
	googleStateTTL = 10 * time.Minute
)

// GoogleIdentity is who Google says signed in.
type GoogleIdentity struct {
	// Subject is the account's stable Google ID. The email can change.
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

// SaveGoogleState remembers a sign-in in progress. The verifier stays here, not in
// the browser, so the redirect back cannot be replayed with a different one.
func (s *Store) SaveGoogleState(ctx context.Context, state, verifier string, now time.Time) error {
	_, err := s.googleStates.InsertOne(ctx, storedGoogleState{
		State:     state,
		Verifier:  verifier,
		ExpiresAt: now.UTC().Add(googleStateTTL),
	})
	return err
}

// TakeGoogleState returns the verifier saved for state and forgets the state, so a
// redirect can be used once.
func (s *Store) TakeGoogleState(ctx context.Context, state string, now time.Time) (string, error) {
	if state == "" {
		return "", ErrGoogleState
	}
	var record storedGoogleState
	err := s.googleStates.FindOneAndDelete(ctx, bson.D{{Key: "state", Value: state}}).Decode(&record)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", ErrGoogleState
	}
	if err != nil {
		return "", err
	}
	if !record.ExpiresAt.After(now) || record.Verifier == "" {
		return "", ErrGoogleState
	}
	return record.Verifier, nil
}

// GoogleSignIn signs in the Acorn account behind a verified Google identity, creating
// one when the email is new. An email account links to Google on its first visit.
func (s *Store) GoogleSignIn(ctx context.Context, id GoogleIdentity, now time.Time) (string, User, error) {
	email := normalizeEmail(id.Email)
	if id.Subject == "" || email == "" || len(email) > maxEmailLength || !strings.Contains(email, "@") || !id.EmailVerified {
		return "", User{}, ErrInvalid
	}
	doc, found, err := s.findGoogleAccount(ctx, id.Subject, email)
	if err != nil {
		return "", User{}, err
	}
	if !found {
		return s.createGoogleAccount(ctx, id, email, now)
	}
	link, err := googleLink(doc.GoogleID, id.Subject)
	if err != nil {
		return "", User{}, err
	}
	if link {
		_, err = s.accounts.UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, bson.D{
			{Key: "$set", Value: bson.D{{Key: "googleId", Value: id.Subject}}},
		})
		if mongo.IsDuplicateKeyError(err) {
			return "", User{}, ErrGoogleMismatch
		}
		if err != nil {
			return "", User{}, err
		}
	}
	token, err := s.insertSession(ctx, doc.ID, now)
	if err != nil {
		return "", User{}, err
	}
	return token, User{ID: doc.ID, Name: doc.Name, Email: doc.Email}, nil
}

// googleLink says whether this Google subject may use the account, and whether this
// is the first time that subject is attached.
func googleLink(existingGoogleID, subject string) (bool, error) {
	switch existingGoogleID {
	case subject:
		return false, nil
	case "":
		return true, nil
	default:
		return false, ErrGoogleMismatch
	}
}

func (s *Store) findGoogleAccount(ctx context.Context, subject, email string) (storedAccount, bool, error) {
	for _, filter := range []bson.D{
		{{Key: "googleId", Value: subject}},
		{{Key: "email", Value: email}},
	} {
		var doc storedAccount
		err := s.accounts.FindOne(ctx, filter).Decode(&doc)
		if err == nil {
			return doc, true, nil
		}
		if !errors.Is(err, mongo.ErrNoDocuments) {
			return storedAccount{}, false, err
		}
	}
	return storedAccount{}, false, nil
}

func (s *Store) createGoogleAccount(ctx context.Context, id GoogleIdentity, email string, now time.Time) (string, User, error) {
	name := googleAccountName(id.Name, email)
	if name == "" {
		return "", User{}, ErrInvalid
	}
	userID, err := newID()
	if err != nil {
		return "", User{}, err
	}
	_, err = s.accounts.InsertOne(ctx, storedAccount{
		ID: userID, Name: name, Email: email, GoogleID: id.Subject, CreatedAt: now.UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		return "", User{}, ErrEmailTaken
	}
	if err != nil {
		return "", User{}, err
	}
	user := User{ID: userID, Name: name, Email: email}
	token, err := s.insertSession(ctx, userID, now)
	if err != nil {
		return "", User{}, err
	}
	return token, user, nil
}

func googleAccountName(name, email string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		local, _, _ := strings.Cut(email, "@")
		name = strings.TrimSpace(local)
	}
	if len(name) > maxNameLength {
		name = strings.TrimSpace(name[:maxNameLength])
	}
	return name
}
