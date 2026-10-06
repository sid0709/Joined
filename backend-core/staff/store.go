package staff

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/employer"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Store is staff review for company verification and direct jobs.
type Store struct {
	client    *mongo.Client
	db        string
	companies string
	listings  *jobs.Store
}

func NewStore(client *mongo.Client, db, companies string, listings *jobs.Store) *Store {
	return &Store{client: client, db: db, companies: companies, listings: listings}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	if _, err := s.verifications().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "createdAt", Value: 1}}},
		{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "status", Value: 1}}},
	}); err != nil {
		return err
	}
	if _, err := s.companiesColl().Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "verificationStatus", Value: 1}},
	}); err != nil {
		return err
	}
	return s.ensureTrustIndexes(ctx)
}

func (s *Store) companiesColl() *mongo.Collection {
	return s.client.Database(s.db).Collection(s.companies)
}

func (s *Store) verifications() *mongo.Collection {
	return s.client.Database(s.db).Collection(verificationsCollection)
}

func (s *Store) hiringJobs() *mongo.Collection {
	return s.client.Database(s.db).Collection(employer.HiringJobsCollection)
}

func (s *Store) members() *mongo.Collection {
	return s.client.Database(s.db).Collection(membersCollection)
}

func (s *Store) users() *mongo.Collection {
	return s.client.Database(s.db).Collection(usersCollection)
}

func (s *Store) auditColl() *mongo.Collection {
	return s.client.Database(s.db).Collection(auditCollection)
}

type storedAudit struct {
	ID          bson.ObjectID `bson:"_id,omitempty"`
	Action      string        `bson:"action"`
	SubjectType string        `bson:"subjectType"`
	SubjectID   string        `bson:"subjectId"`
	Actor       string        `bson:"actor"`
	Note        string        `bson:"note,omitempty"`
	At          time.Time     `bson:"at"`
}

// WriteAudit records one admin_audit row and returns its id.
func (s *Store) WriteAudit(ctx context.Context, action, subjectType, subjectID, actor, note string, now time.Time) (string, error) {
	return s.audit(ctx, action, subjectType, subjectID, actor, note, now)
}

// AuditsFor returns the recent audit rows for one subject, newest first.
func (s *Store) AuditsFor(ctx context.Context, subjectID string) ([]AuditEntry, error) {
	return s.auditTrail(ctx, subjectID)
}

func (s *Store) audit(ctx context.Context, action, subjectType, subjectID, actor, note string, now time.Time) (string, error) {
	doc := storedAudit{
		ID:          bson.NewObjectID(),
		Action:      action,
		SubjectType: subjectType,
		SubjectID:   subjectID,
		Actor:       actor,
		Note:        note,
		At:          now.UTC(),
	}
	if _, err := s.auditColl().InsertOne(ctx, doc); err != nil {
		return "", err
	}
	return doc.ID.Hex(), nil
}

func (s *Store) auditTrail(ctx context.Context, subjectID string) ([]AuditEntry, error) {
	cursor, err := s.auditColl().Find(ctx, bson.D{{Key: "subjectId", Value: subjectID}},
		options.Find().SetSort(bson.D{{Key: "at", Value: -1}}).SetLimit(auditLimit))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []storedAudit
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	if len(docs) == 0 {
		return nil, nil
	}
	out := make([]AuditEntry, len(docs))
	for i, doc := range docs {
		out[i] = AuditEntry{
			Action:      doc.Action,
			SubjectType: doc.SubjectType,
			SubjectID:   doc.SubjectID,
			Actor:       doc.Actor,
			Note:        doc.Note,
			At:          doc.At,
		}
	}
	return out, nil
}

func websiteHost(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	if !strings.Contains(host, ".") {
		return ""
	}
	return host
}

func cleanDomains(values []string) []string {
	out := []string{}
	seen := map[string]struct{}{}
	for _, value := range values {
		name := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(value)), "www.")
		if name == "" || strings.Contains(name, " ") || !strings.Contains(name, ".") {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
		if len(out) == 8 {
			break
		}
	}
	return out
}

func uniqueIDs(ids []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
