package staff

import (
	"context"
	"log/slog"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/employer"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	casesCollection = "moderation_cases"
	auditCollection = "admin_audit"
)

// Store is staff moderation for company verification and direct-job review.
type Store struct {
	client    *mongo.Client
	db        string
	companies string
	search    string
	accounts  *auth.Store
	hiring    *employer.Store
}

func NewStore(client *mongo.Client, db, companies, searchJobs string, accounts *auth.Store, hiring *employer.Store) *Store {
	return &Store{client: client, db: db, companies: companies, search: searchJobs, accounts: accounts, hiring: hiring}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	if _, err := s.cases().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "queue", Value: 1}, {Key: "status", Value: 1}, {Key: "createdAt", Value: 1}}},
		{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "status", Value: 1}}},
	}); err != nil {
		return err
	}
	if _, err := s.searchJobs().Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "source", Value: 1}, {Key: "listingStatus", Value: 1}, {Key: "postedAt", Value: -1}},
	}); err != nil {
		return err
	}
	_, err := s.companiesColl().Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "trustStatus", Value: 1}},
	})
	return err
}

func (s *Store) companiesColl() *mongo.Collection {
	return s.client.Database(s.db).Collection(s.companies)
}

func (s *Store) searchJobs() *mongo.Collection {
	return s.client.Database(s.db).Collection(s.search)
}

func (s *Store) cases() *mongo.Collection {
	return s.client.Database(s.db).Collection(casesCollection)
}

func (s *Store) hiringJobs() *mongo.Collection {
	return s.client.Database(s.db).Collection(employer.HiringJobsCollection)
}

func (s *Store) auditColl() *mongo.Collection {
	return s.client.Database(s.db).Collection(auditCollection)
}

func (s *Store) audit(ctx context.Context, action, subjectType, subjectID, actor, note string, now time.Time) {
	_, err := s.auditColl().InsertOne(ctx, AuditEntry{
		Action:      action,
		SubjectType: subjectType,
		SubjectID:   subjectID,
		Actor:       actor,
		Note:        note,
		At:          now.UTC(),
	})
	if err != nil {
		slog.Error("audit", "action", action, "subject", subjectID, "error", err)
	}
}

func (s *Store) auditTrail(ctx context.Context, subjectID string) ([]AuditEntry, error) {
	cursor, err := s.auditColl().Find(ctx, bson.D{{Key: "subjectId", Value: subjectID}},
		options.Find().SetSort(bson.D{{Key: "at", Value: -1}}).SetLimit(auditLimit))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	rows := []AuditEntry{}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
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

func nameFilter(q string) bson.D {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil
	}
	regex := bson.D{{Key: "$regex", Value: regexp.QuoteMeta(q)}, {Key: "$options", Value: "i"}}
	return bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "companyName", Value: regex}},
		bson.D{{Key: "overrides.name", Value: regex}},
	}}}
}

func andFilter(parts ...bson.D) bson.D {
	clauses := bson.A{}
	for _, part := range parts {
		if len(part) == 0 {
			continue
		}
		clauses = append(clauses, part)
	}
	switch len(clauses) {
	case 0:
		return bson.D{}
	case 1:
		return clauses[0].(bson.D)
	default:
		return bson.D{{Key: "$and", Value: clauses}}
	}
}
