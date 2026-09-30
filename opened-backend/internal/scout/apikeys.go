package scout

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	// APIKeyPrefix starts every scout API key so it can be told apart from a
	// web session token in the same Authorization header.
	APIKeyPrefix     = "scw_"
	apiKeyBytes      = 24
	apiKeyShownChars = 8
	maxActiveKeys    = 10
	maxKeyName       = 60
	// touchEvery limits how often lastUsedAt is written.
	touchEvery = time.Minute
)

// ErrInvalidKey means the bearer token is not a live API key.
var ErrInvalidKey = errors.New("invalid or revoked API key")

// APIKey is a scout's credential for the submission API. The secret is only
// returned once, at creation; the store keeps its SHA-256.
type APIKey struct {
	ObjectID   bson.ObjectID `json:"-" bson:"_id"`
	ID         string        `json:"id" bson:"-"`
	UserID     string        `json:"-" bson:"userId"`
	Name       string        `json:"name" bson:"name"`
	Hash       string        `json:"-" bson:"hash"`
	Prefix     string        `json:"prefix" bson:"prefix"`
	CreatedAt  time.Time     `json:"created_at" bson:"createdAt"`
	LastUsedAt *time.Time    `json:"last_used_at" bson:"lastUsedAt,omitempty"`
	RevokedAt  *time.Time    `json:"revoked_at" bson:"revokedAt,omitempty"`
}

// CreatedAPIKey carries the one-time secret.
type CreatedAPIKey struct {
	APIKey
	Secret string `json:"secret"`
}

// IsAPIKey reports whether a bearer token looks like a scout API key.
func IsAPIKey(token string) bool {
	return strings.HasPrefix(token, APIKeyPrefix)
}

func hashKey(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func newKeySecret() (string, error) {
	raw := make([]byte, apiKeyBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return APIKeyPrefix + hex.EncodeToString(raw), nil
}

// CreateAPIKey issues a new key for the scout.
func (s *Store) CreateAPIKey(ctx context.Context, userID, name string) (CreatedAPIKey, error) {
	profile, err := s.EnsureProfile(ctx, userID)
	if err != nil {
		return CreatedAPIKey{}, err
	}
	if profile.TermsAcceptedAt == nil {
		return CreatedAPIKey{}, ErrTermsRequired
	}
	name = clean(name)
	if name == "" || utf8.RuneCountInString(name) > maxKeyName {
		return CreatedAPIKey{}, &ValidationError{Fields: []FieldError{{Field: "name", Detail: "name the key (up to 60 characters)"}}}
	}
	active, err := s.collection(apiKeysCollection).CountDocuments(ctx, bson.D{
		{Key: "userId", Value: userID},
		{Key: "revokedAt", Value: bson.D{{Key: "$exists", Value: false}}},
	})
	if err != nil {
		return CreatedAPIKey{}, err
	}
	if active >= maxActiveKeys {
		return CreatedAPIKey{}, ErrKeyLimit
	}
	secret, err := newKeySecret()
	if err != nil {
		return CreatedAPIKey{}, err
	}
	key := APIKey{
		ObjectID:  bson.NewObjectID(),
		UserID:    userID,
		Name:      name,
		Hash:      hashKey(secret),
		Prefix:    secret[:len(APIKeyPrefix)+apiKeyShownChars],
		CreatedAt: s.now().UTC(),
	}
	if _, err := s.collection(apiKeysCollection).InsertOne(ctx, key); err != nil {
		return CreatedAPIKey{}, err
	}
	key.ID = key.ObjectID.Hex()
	return CreatedAPIKey{APIKey: key, Secret: secret}, nil
}

// ListAPIKeys returns the scout's keys, newest first, revoked ones included.
func (s *Store) ListAPIKeys(ctx context.Context, userID string) ([]APIKey, error) {
	cursor, err := s.collection(apiKeysCollection).Find(ctx, bson.D{{Key: "userId", Value: userID}},
		options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}))
	if err != nil {
		return nil, err
	}
	keys := []APIKey{}
	if err := cursor.All(ctx, &keys); err != nil {
		return nil, err
	}
	for i := range keys {
		keys[i].ID = keys[i].ObjectID.Hex()
	}
	return keys, nil
}

// RevokeAPIKey stops a key from authenticating.
func (s *Store) RevokeAPIKey(ctx context.Context, userID, id string) error {
	oid, err := objectID(id)
	if err != nil {
		return err
	}
	now := s.now().UTC()
	result, err := s.collection(apiKeysCollection).UpdateOne(ctx,
		bson.D{{Key: "_id", Value: oid}, {Key: "userId", Value: userID}, {Key: "revokedAt", Value: bson.D{{Key: "$exists", Value: false}}}},
		bson.D{{Key: "$set", Value: bson.D{{Key: "revokedAt", Value: now}}}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

// Authenticate resolves an API key to its scout.
func (s *Store) Authenticate(ctx context.Context, secret string) (Actor, error) {
	if !IsAPIKey(secret) {
		return Actor{}, ErrInvalidKey
	}
	var key APIKey
	err := s.collection(apiKeysCollection).FindOne(ctx, bson.D{
		{Key: "hash", Value: hashKey(secret)},
		{Key: "revokedAt", Value: bson.D{{Key: "$exists", Value: false}}},
	}).Decode(&key)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Actor{}, ErrInvalidKey
	}
	if err != nil {
		return Actor{}, err
	}
	now := s.now().UTC()
	if key.LastUsedAt == nil || now.Sub(*key.LastUsedAt) > touchEvery {
		_, _ = s.collection(apiKeysCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: key.ObjectID}},
			bson.D{{Key: "$set", Value: bson.D{{Key: "lastUsedAt", Value: now}}}})
	}
	return Actor{UserID: key.UserID, APIKeyID: key.ObjectID.Hex()}, nil
}
