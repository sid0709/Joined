package scout

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
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
	rec := idempotencyRecord{
		UserID:    userID,
		Route:     route,
		Key:       key,
		BodyHash:  hash,
		CreatedAt: s.now().UTC(),
	}

	err := s.claimIdempotency(ctx, rec)
	if mongo.IsDuplicateKeyError(err) {
		existing, loadErr := s.loadIdempotency(ctx, userID, route, key)
		if loadErr != nil {
			return Replay{}, false, loadErr
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
		return result, false, s.dropIdempotency(ctx, userID, route, key)
	}
	if err := s.completeIdempotency(ctx, userID, route, key, result); err != nil {
		if dropErr := s.dropIdempotency(ctx, userID, route, key); dropErr != nil {
			return result, false, fmt.Errorf("complete idempotency: %w (also drop: %v)", err, dropErr)
		}
		return result, false, fmt.Errorf("complete idempotency: %w", err)
	}
	return result, false, nil
}

func (s *Store) claimIdempotency(ctx context.Context, rec idempotencyRecord) error {
	if s.docs != nil {
		return s.docs.insertIdempotency(ctx, rec)
	}
	_, err := s.collection(idempotencyCollection).InsertOne(ctx, rec)
	return err
}

func (s *Store) loadIdempotency(ctx context.Context, userID, route, key string) (idempotencyRecord, error) {
	if s.docs != nil {
		return s.docs.findIdempotency(ctx, userID, route, key)
	}
	var existing idempotencyRecord
	err := s.collection(idempotencyCollection).FindOne(ctx, bson.D{
		{Key: "userId", Value: userID}, {Key: "route", Value: route}, {Key: "key", Value: key},
	}).Decode(&existing)
	return existing, err
}

func (s *Store) dropIdempotency(ctx context.Context, userID, route, key string) error {
	if s.docs != nil {
		return s.docs.deleteIdempotency(ctx, userID, route, key)
	}
	_, err := s.collection(idempotencyCollection).DeleteOne(ctx, bson.D{
		{Key: "userId", Value: userID}, {Key: "route", Value: route}, {Key: "key", Value: key},
	})
	return err
}

func (s *Store) completeIdempotency(ctx context.Context, userID, route, key string, result Replay) error {
	if s.docs != nil {
		return s.docs.finishIdempotency(ctx, userID, route, key, result.Status, result.Body)
	}
	_, err := s.collection(idempotencyCollection).UpdateOne(ctx, bson.D{
		{Key: "userId", Value: userID}, {Key: "route", Value: route}, {Key: "key", Value: key},
	}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "done", Value: true},
		{Key: "status", Value: result.Status},
		{Key: "body", Value: result.Body},
	}}})
	return err
}
