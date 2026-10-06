package scout

import (
	"context"
	"log/slog"
	"math/rand/v2"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	profilesCollection      = "scout_profiles"
	submissionsCollection   = "scout_submissions"
	earningsCollection      = "scout_earnings"
	payoutsCollection       = "scout_payouts"
	notificationsCollection = "scout_notifications"
	apiKeysCollection       = "scout_api_keys"
	idempotencyCollection   = "scout_idempotency"
	auditCollection         = "admin_audit"

	// checkTimeout bounds one run of the automatic checks (docs/13: 60 s).
	checkTimeout = 60 * time.Second
	// checkRetries is how many times a failed run is retried.
	checkRetries = 2
	// checkWorkers caps how many submissions are checked at once.
	checkWorkers = 8
	// stuckAfter is when a submission left mid-check by a restart is picked up again.
	stuckAfter = 2 * time.Minute

	defaultListLimit = 25
	maxListLimit     = 100
)

// Accounts is the part of the auth store scouts need.
type Accounts interface {
	Account(ctx context.Context, userID string) (auth.User, time.Time, error)
	SetName(ctx context.Context, userID, name string) error
	Users(ctx context.Context, ids []string) (map[string]auth.User, error)
	SearchUserIDs(ctx context.Context, query string) ([]string, error)
}

// Publisher puts approved jobs into (and takes them out of) the search pool.
type Publisher interface {
	PublishScouted(ctx context.Context, listing jobs.ScoutedListing, now time.Time) (jobs.PublishedJob, error)
	UnpublishScouted(ctx context.Context, ref string) error
	// StageScouted stores a submission for staff to analyze. It does not enter search.
	StageScouted(ctx context.Context, listing jobs.ScoutedListing, now time.Time) (string, error)
	JobWithApplyLink(ctx context.Context, links []string) (string, error)
	JobsWithApplyLink(ctx context.Context, links []string) ([]jobs.JobBrief, error)
	JobsMatchingCompanyTitle(ctx context.Context, companyID, companyName, title string) ([]jobs.JobBrief, error)
	JobBriefsByID(ctx context.Context, ids []string) ([]jobs.JobBrief, error)
}

// Usage reports candidate activity on published jobs.
type Usage interface {
	UsageByJob(ctx context.Context, jobIDs []string) (map[string]candidate.JobUsage, error)
}

// Store is the scout domain over MongoDB.
type Store struct {
	client    *mongo.Client
	db        string
	accounts  Accounts
	publisher Publisher
	usage     Usage
	fetcher   Fetcher
	config    Config

	now  func() time.Time
	roll func() float64

	// docs is an optional in-memory seam. Nil means Mongo via collection().
	docs documents

	// Storage hooks for testing RecordApply
	findSubmissionByJobID func(ctx context.Context, jobID string) (Submission, error)
	insertEarning         func(ctx context.Context, earning Earning) error
	notifyReward          func(ctx context.Context, userID string, earning Earning)

	workers   chan struct{}
	pending   sync.WaitGroup
	publishMu sync.Mutex
	payoutMu  sync.Mutex

	payoutProvider Provider
	screener       Screener
}

// NewStore wires the scout store. fetcher follows submitted links.
func NewStore(client *mongo.Client, db string, accounts Accounts, publisher Publisher, usage Usage, fetcher Fetcher) *Store {
	s := &Store{
		client:         client,
		db:             db,
		accounts:       accounts,
		publisher:      publisher,
		usage:          usage,
		fetcher:        fetcher,
		config:         LoadConfig(),
		now:            time.Now,
		roll:           rand.Float64,
		workers:        make(chan struct{}, checkWorkers),
		payoutProvider: NewFakeProvider(),
	}
	// Default to production implementations
	s.findSubmissionByJobID = s.submissionByJobID
	s.insertEarning = s.insertEarningMongo
	s.notifyReward = func(ctx context.Context, userID string, earning Earning) {
		s.notifyRewardImpl(ctx, userID, earning)
	}
	s.screener = screenerFromEnv()
	return s
}

// EnsureIndexes creates every index the scout collections rely on.
func (s *Store) EnsureIndexes(ctx context.Context) error {
	indexes := []struct {
		name  string
		model mongo.IndexModel
	}{
		{profilesCollection, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{profilesCollection, mongo.IndexModel{Keys: bson.D{{Key: "verification", Value: 1}}}},
		{submissionsCollection, mongo.IndexModel{Keys: bson.D{{Key: "scoutUserId", Value: 1}, {Key: "_id", Value: -1}}}},
		{submissionsCollection, mongo.IndexModel{Keys: bson.D{{Key: "status", Value: 1}, {Key: "_id", Value: 1}}}},
		{submissionsCollection, mongo.IndexModel{Keys: bson.D{{Key: "canonicalUrl", Value: 1}}}},
		{submissionsCollection, mongo.IndexModel{Keys: bson.D{{Key: "dedupeKey", Value: 1}}}},
		{submissionsCollection, mongo.IndexModel{Keys: bson.D{{Key: "scoutUserId", Value: 1}, {Key: "updatedAt", Value: -1}}}},
		{submissionsCollection, mongo.IndexModel{Keys: applyCreditSubmissionIndex()}},
		{submissionsCollection, mongo.IndexModel{
			Keys: bson.D{{Key: "scoutUserId", Value: 1}, {Key: "externalRef", Value: 1}},
			Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.D{
				{Key: "externalRef", Value: bson.D{{Key: "$type", Value: "string"}}},
			}),
		}},
		{earningsCollection, mongo.IndexModel{Keys: bson.D{{Key: "scoutUserId", Value: 1}, {Key: "_id", Value: -1}}}},
		{earningsCollection, mongo.IndexModel{Keys: bson.D{{Key: "status", Value: 1}, {Key: "holdUntil", Value: 1}}}},
		{earningsCollection, mongo.IndexModel{
			Keys: bson.D{{Key: "type", Value: 1}, {Key: "submissionId", Value: 1}, {Key: "jobId", Value: 1}, {Key: "candidateId", Value: 1}},
			Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.D{
				{Key: "type", Value: RewardApply},
			}),
		}},
		{payoutsCollection, mongo.IndexModel{Keys: bson.D{{Key: "scoutUserId", Value: 1}, {Key: "_id", Value: -1}}}},
		{payoutsCollection, mongo.IndexModel{Keys: bson.D{{Key: "status", Value: 1}, {Key: "_id", Value: 1}}}},
		{payoutsCollection, mongo.IndexModel{
			Keys: bson.D{{Key: "providerRef", Value: 1}},
			Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.D{
				{Key: "providerRef", Value: bson.D{{Key: "$type", Value: "string"}}},
			}),
		}},
		{notificationsCollection, mongo.IndexModel{Keys: bson.D{{Key: "scoutUserId", Value: 1}, {Key: "_id", Value: -1}}}},
		{notificationsCollection, mongo.IndexModel{
			Keys: bson.D{{Key: "key", Value: 1}},
			Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.D{
				{Key: "key", Value: bson.D{{Key: "$type", Value: "string"}}},
			}),
		}},
		{apiKeysCollection, mongo.IndexModel{Keys: bson.D{{Key: "hash", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{apiKeysCollection, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}}},
		{idempotencyCollection, mongo.IndexModel{
			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "route", Value: 1}, {Key: "key", Value: 1}},
			Options: options.Index().SetUnique(true),
		}},
		{idempotencyCollection, mongo.IndexModel{
			Keys:    bson.D{{Key: "createdAt", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(int32(idempotencyTTL / time.Second)),
		}},
		{auditCollection, mongo.IndexModel{Keys: bson.D{{Key: "subjectId", Value: 1}, {Key: "at", Value: -1}}}},
	}
	for _, index := range indexes {
		if _, err := s.collection(index.name).Indexes().CreateOne(ctx, index.model); err != nil {
			return err
		}
	}
	return nil
}

// ResumePending re-queues submissions a restart left unchecked.
func (s *Store) ResumePending(ctx context.Context) (int, error) {
	cutoff := s.now().Add(-stuckAfter)
	cursor, err := s.collection(submissionsCollection).Find(ctx, bson.D{
		{Key: "status", Value: bson.D{{Key: "$in", Value: bson.A{StatusSubmitted, StatusAutoChecking}}}},
		{Key: "updatedAt", Value: bson.D{{Key: "$lt", Value: cutoff}}},
	}, options.Find().SetProjection(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)
	count := 0
	for cursor.Next(ctx) {
		var row struct {
			ID bson.ObjectID `bson:"_id"`
		}
		if err := cursor.Decode(&row); err != nil {
			return count, err
		}
		s.enqueue(row.ID)
		count++
	}
	return count, cursor.Err()
}

// Wait blocks until queued checks finish; used on shutdown and in tests.
func (s *Store) Wait() { s.pending.Wait() }

// enqueue runs the automatic checks in the background with retries.
func (s *Store) enqueue(id bson.ObjectID) {
	if s.workers == nil {
		return
	}
	s.pending.Add(1)
	go func() {
		defer s.pending.Done()
		s.workers <- struct{}{}
		defer func() { <-s.workers }()
		for attempt := 0; attempt <= checkRetries; attempt++ {
			ctx, cancel := context.WithTimeout(context.Background(), checkTimeout)
			err := s.process(ctx, id)
			cancel()
			if err == nil {
				return
			}
			slog.Error("scout auto check", "submission", id.Hex(), "attempt", attempt+1, "error", err)
		}
	}()
}

func (s *Store) collection(name string) *mongo.Collection {
	return s.client.Database(s.db).Collection(name)
}

// SetPayoutProvider replaces the payout rail. Nil falls back to the fake.
func (s *Store) SetPayoutProvider(provider Provider) {
	if provider == nil {
		provider = NewFakeProvider()
	}
	s.payoutProvider = provider
}

// audit records a staff action (docs/40: every admin action is audited).
func (s *Store) audit(ctx context.Context, action, subjectType, subjectID, actor, note string) {
	entry := AuditEntry{
		Action:      action,
		SubjectType: subjectType,
		SubjectID:   subjectID,
		Actor:       actor,
		Note:        note,
		At:          s.now().UTC(),
	}
	if mem, ok := s.docs.(*memDocs); ok {
		mem.addAudit(entry)
		return
	}
	if s.client == nil {
		return
	}
	_, err := s.collection(auditCollection).InsertOne(ctx, entry)
	if err != nil {
		slog.Error("audit", "action", action, "subject", subjectID, "error", err)
	}
}

// AuditEntry is one row of the admin audit log.
type AuditEntry struct {
	Action      string    `json:"action" bson:"action"`
	SubjectType string    `json:"subject_type" bson:"subjectType"`
	SubjectID   string    `json:"subject_id" bson:"subjectId"`
	Actor       string    `json:"actor" bson:"actor"`
	Note        string    `json:"note,omitempty" bson:"note,omitempty"`
	At          time.Time `json:"at" bson:"at"`
}

// listLimit clamps a requested page size.
func listLimit(limit int) int {
	switch {
	case limit <= 0:
		return defaultListLimit
	case limit > maxListLimit:
		return maxListLimit
	default:
		return limit
	}
}

// cursorFilter pages newest-first by _id: the cursor is the last id returned.
func cursorFilter(filter bson.D, cursor string) (bson.D, error) {
	if cursor == "" {
		return filter, nil
	}
	id, err := bson.ObjectIDFromHex(cursor)
	if err != nil {
		return nil, &ValidationError{Fields: []FieldError{{Field: "cursor", Detail: "invalid cursor"}}}
	}
	return append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$lt", Value: id}}}), nil
}

func objectID(id string) (bson.ObjectID, error) {
	parsed, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return bson.ObjectID{}, ErrNotFound
	}
	return parsed, nil
}
