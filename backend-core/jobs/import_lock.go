package jobs

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ImportLock keeps one scheduled import run at a time.
type ImportLock interface {
	TryLock(ctx context.Context) (unlock func(), acquired bool, err error)
}

// MemoryLock is the in-process lock tests and a single API process use.
type MemoryLock struct {
	mu   sync.Mutex
	held bool
}

func (l *MemoryLock) TryLock(context.Context) (func(), bool, error) {
	if l == nil {
		return func() {}, true, nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.held {
		return nil, false, nil
	}
	l.held = true
	return func() {
		l.mu.Lock()
		l.held = false
		l.mu.Unlock()
	}, true, nil
}

type importLockDoc struct {
	ID        string    `bson:"_id"`
	Owner     string    `bson:"owner"`
	ExpiresAt time.Time `bson:"expiresAt"`
}

// StoreImportLock is the in-process lock plus a Mongo document so two admin
// processes do not import at once.
type StoreImportLock struct {
	store      *Store
	collection string
	ttl        time.Duration
	mem        MemoryLock
	now        func() time.Time
}

func NewStoreImportLock(store *Store, collection string, ttl time.Duration) *StoreImportLock {
	if collection == "" {
		collection = config.DefaultJobImportLocksCollection
	}
	if ttl <= 0 {
		ttl = defaultImportInterval
	}
	return &StoreImportLock{
		store:      store,
		collection: collection,
		ttl:        ttl,
		now:        time.Now,
	}
}

func (l *StoreImportLock) TryLock(ctx context.Context) (func(), bool, error) {
	unlockMem, ok, err := l.mem.TryLock(ctx)
	if err != nil || !ok {
		return unlockMem, ok, err
	}
	if l.store == nil || l.store.client == nil {
		return unlockMem, true, nil
	}
	unlockMongo, ok, err := l.tryMongo(ctx)
	if err != nil || !ok {
		unlockMem()
		return nil, ok, err
	}
	return func() {
		unlockMongo()
		unlockMem()
	}, true, nil
}

func (l *StoreImportLock) tryMongo(ctx context.Context) (func(), bool, error) {
	now := l.now().UTC()
	owner := importLockOwner()
	coll := l.store.client.Database(l.store.destDB).Collection(l.collection)
	filter := bson.D{
		{Key: "_id", Value: importLockDocumentID},
		{Key: "$or", Value: bson.A{
			bson.D{{Key: "expiresAt", Value: bson.D{{Key: "$lte", Value: now}}}},
			bson.D{{Key: "owner", Value: ""}},
		}},
	}
	update := bson.D{{Key: "$set", Value: importLockDoc{
		ID:        importLockDocumentID,
		Owner:     owner,
		ExpiresAt: now.Add(l.ttl),
	}}}
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)
	var doc importLockDoc
	err := coll.FindOneAndUpdate(ctx, filter, update, opts).Decode(&doc)
	if err == nil {
		if doc.Owner != owner {
			return nil, false, nil
		}
		return func() {
			releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, _ = coll.UpdateOne(releaseCtx, bson.D{
				{Key: "_id", Value: importLockDocumentID},
				{Key: "owner", Value: owner},
			}, bson.D{{Key: "$set", Value: bson.D{
				{Key: "owner", Value: ""},
				{Key: "expiresAt", Value: l.now().UTC()},
			}}})
		}, true, nil
	}
	if isLockNotAcquired(err) {
		return nil, false, nil
	}
	return nil, false, fmt.Errorf("acquire import lock: %w", err)
}

func isLockNotAcquired(err error) bool {
	return errors.Is(err, mongo.ErrNoDocuments) || mongo.IsDuplicateKeyError(err)
}

func importLockOwner() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "import"
	}
	id, err := newPublicID()
	if err != nil {
		return fmt.Sprintf("%s-%d", host, time.Now().UnixNano())
	}
	return host + "-" + id
}
