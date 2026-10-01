package scout

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

const (
	// idempotencyTTL is how long a key replays its response (docs/60: 24 h).
	idempotencyTTL   = 24 * time.Hour
	maxIdempotentKey = 255
)

// ErrIdempotencyInFlight means the first request with this key is still running.
var ErrIdempotencyInFlight = errors.New("a request with this Idempotency-Key is still in progress")

// Replay is a stored response for an idempotent request.
type Replay struct {
	Status int
	Body   []byte
}

type idempotencyRecord struct {
	UserID    string    `bson:"userId"`
	Route     string    `bson:"route"`
	Key       string    `bson:"key"`
	BodyHash  string    `bson:"bodyHash"`
	Done      bool      `bson:"done"`
	Status    int       `bson:"status"`
	Body      []byte    `bson:"body"`
	CreatedAt time.Time `bson:"createdAt"`
}

// ValidIdempotencyKey reports whether a header value can be used as a key.
func ValidIdempotencyKey(key string) bool {
	key = strings.TrimSpace(key)
	return key != "" && len(key) <= maxIdempotentKey
}

// Idempotent runs fn once per (user, route, key). The same key with the same
// body replays the first response; with a different body it is a conflict.
func (s *Store) Idempotent(ctx context.Context, userID, route, key string, body []byte, fn func() Replay) (Replay, bool, error) {
	sum := sha256.Sum256(body)
	hash := hex.EncodeToString(sum[:])
	filter := bson.D{{Key: "userId", Value: userID}, {Key: "route", Value: route}, {Key: "key", Value: key}}

	_, err := s.collection(idempotencyCollection).InsertOne(ctx, idempotencyRecord{
		UserID:    userID,
		Route:     route,
		Key:       key,
		BodyHash:  hash,
		CreatedAt: s.now().UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		var existing idempotencyRecord
		if err := s.collection(idempotencyCollection).FindOne(ctx, filter).Decode(&existing); err != nil {
			return Replay{}, false, err
		}
		if existing.BodyHash != hash {
			return Replay{}, false, ErrIdempotency
		}
		if !existing.Done {
			return Replay{}, false, ErrIdempotencyInFlight
		}
		return Replay{Status: existing.Status, Body: existing.Body}, true, nil
	}
	if err != nil {
		return Replay{}, false, err
	}

	result := fn()
	// Server errors are not cached, so the client can retry with the same key.
	if result.Status >= 500 {
		_, err := s.collection(idempotencyCollection).DeleteOne(ctx, filter)
		return result, false, err
	}
	_, err = s.collection(idempotencyCollection).UpdateOne(ctx, filter, bson.D{{Key: "$set", Value: bson.D{
		{Key: "done", Value: true},
		{Key: "status", Value: result.Status},
		{Key: "body", Value: result.Body},
	}}})
	return result, false, err
}
