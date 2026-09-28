package candidate

import (
	"context"
	"errors"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	profilesCollection     = "profiles"
	savedJobsCollection    = "saved_jobs"
	applicationsCollection = "applications"
	interviewsCollection   = "interviews"
	calendarCollection     = "calendar_connections"
	oauthStatesCollection  = "oauth_states"
	threadsCollection      = "threads"
	messagesCollection     = "messages"
	threadReadsCollection  = "thread_reads"
)

type Accounts interface {
	Account(ctx context.Context, userID string) (auth.User, time.Time, error)
	SetName(ctx context.Context, userID, name string) error
}

type Store struct {
	client   *mongo.Client
	db       string
	catalog  Catalog
	accounts Accounts
	calendar CalendarProvider
}

func NewStore(client *mongo.Client, db string, catalog Catalog, accounts Accounts, calendar CalendarProvider) *Store {
	return &Store{client: client, db: db, catalog: catalog, accounts: accounts, calendar: calendar}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	indexes := []struct {
		name  string
		model mongo.IndexModel
	}{
		{profilesCollection, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{savedJobsCollection, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "jobId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{applicationsCollection, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "jobId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{interviewsCollection, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "googleEventId", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)}},
		{calendarCollection, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{oauthStatesCollection, mongo.IndexModel{Keys: bson.D{{Key: "state", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{threadsCollection, mongo.IndexModel{Keys: bson.D{{Key: "applicationId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{messagesCollection, mongo.IndexModel{Keys: bson.D{{Key: "threadId", Value: 1}, {Key: "createdAt", Value: 1}}}},
		{threadReadsCollection, mongo.IndexModel{Keys: bson.D{{Key: "threadId", Value: 1}, {Key: "userId", Value: 1}}, Options: options.Index().SetUnique(true)}},
	}
	for _, index := range indexes {
		if _, err := s.collection(index.name).Indexes().CreateOne(ctx, index.model); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteUser(ctx context.Context, userID string) error {
	filter := bson.D{{Key: "userId", Value: userID}}
	for _, name := range []string{profilesCollection, savedJobsCollection, applicationsCollection, interviewsCollection, calendarCollection} {
		if _, err := s.collection(name).DeleteMany(ctx, filter); err != nil {
			return err
		}
	}
	if _, err := s.collection(oauthStatesCollection).DeleteMany(ctx, filter); err != nil {
		return err
	}
	threads, err := s.collection(threadsCollection).Find(ctx, bson.D{{Key: "candidateUserId", Value: userID}})
	if err != nil {
		return err
	}
	defer threads.Close(ctx)
	var ids []string
	for threads.Next(ctx) {
		var doc storedThread
		if err := threads.Decode(&doc); err != nil {
			return err
		}
		ids = append(ids, doc.ID)
	}
	if err := threads.Err(); err != nil {
		return err
	}
	if len(ids) > 0 {
		if _, err := s.collection(messagesCollection).DeleteMany(ctx, bson.D{{Key: "threadId", Value: bson.D{{Key: "$in", Value: ids}}}}); err != nil {
			return err
		}
		if _, err := s.collection(threadReadsCollection).DeleteMany(ctx, bson.D{{Key: "threadId", Value: bson.D{{Key: "$in", Value: ids}}}}); err != nil {
			return err
		}
	}
	if _, err := s.collection(threadsCollection).DeleteMany(ctx, bson.D{{Key: "candidateUserId", Value: userID}}); err != nil {
		return err
	}
	if _, err := s.collection(threadReadsCollection).DeleteMany(ctx, bson.D{{Key: "userId", Value: userID}}); err != nil {
		return err
	}
	return nil
}

func (s *Store) collection(name string) *mongo.Collection {
	return s.client.Database(s.db).Collection(name)
}

func isDup(err error) bool {
	return mongo.IsDuplicateKeyError(err)
}

func notFound(err error) bool {
	return errors.Is(err, mongo.ErrNoDocuments)
}
