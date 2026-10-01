package employer

import (
	"context"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	jobsCollection = "company_jobs"

	// HiringJobsCollection is the workspace copy of a company's jobs.
	HiringJobsCollection      = jobsCollection
	jobTeamsCollection        = "company_job_teams"
	jobTemplatesCollection    = "company_job_templates"
	officeLocationsCollection = "company_office_locations"
	walletsCollection         = "company_wallets"
	ledgerCollection          = "company_ledger"
	activityCollection        = "company_activity"
	invitesCollection         = "company_invites"
	settingsCollection        = "company_settings"
	profilesCollection        = "hiring_profiles"
	scorecardsCollection      = "company_scorecards"
	activityLimit             = 12
	weekDays                  = 7
)

// Store is the hiring workspace: jobs, prepaid balance, and the people on them.
type Store struct {
	client   *mongo.Client
	db       string
	jobs     *jobs.Store
	people   *candidate.Store
	accounts *auth.Store
}

func NewStore(client *mongo.Client, db string, listings *jobs.Store, people *candidate.Store, accounts *auth.Store) *Store {
	return &Store{client: client, db: db, jobs: listings, people: people, accounts: accounts}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	indexes := []struct {
		name  string
		model mongo.IndexModel
	}{
		{jobsCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "updatedAt", Value: -1}}}},
		{jobsCollection, mongo.IndexModel{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{jobTeamsCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{jobTemplatesCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{officeLocationsCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{walletsCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{ledgerCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "createdAt", Value: -1}}}},
		{activityCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "createdAt", Value: -1}}}},
		{invitesCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{settingsCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{profilesCollection, mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{scorecardsCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "applicantId", Value: 1}, {Key: "submittedAt", Value: -1}}}},
		{auditCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "at", Value: -1}, {Key: "id", Value: -1}}}},
		{auditCollection, mongo.IndexModel{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetUnique(true)}},
		{jobAccessCollection, mongo.IndexModel{Keys: bson.D{{Key: "companyId", Value: 1}, {Key: "jobId", Value: 1}}, Options: options.Index().SetUnique(true)}},
	}
	for _, index := range indexes {
		if _, err := s.collection(index.name).Indexes().CreateOne(ctx, index.model); err != nil {
			return err
		}
	}
	return nil
}

// DeleteCompany removes hiring records that exist only for this company page.
func (s *Store) DeleteCompany(ctx context.Context, companyID string) error {
	if companyID == "" {
		return nil
	}
	filter := bson.D{{Key: "companyId", Value: companyID}}
	for _, name := range []string{jobsCollection, jobTeamsCollection, jobTemplatesCollection, officeLocationsCollection, walletsCollection, ledgerCollection, activityCollection, invitesCollection, settingsCollection, scorecardsCollection, auditCollection, jobAccessCollection} {
		if _, err := s.collection(name).DeleteMany(ctx, filter); err != nil {
			return err
		}
	}
	return nil
}

// DeleteUser removes the hiring profile that belongs to the person.
func (s *Store) DeleteUser(ctx context.Context, userID string) error {
	if userID == "" {
		return nil
	}
	_, err := s.collection(profilesCollection).DeleteOne(ctx, bson.D{{Key: "userId", Value: userID}})
	return err
}

func (s *Store) collection(name string) *mongo.Collection {
	return s.client.Database(s.db).Collection(name)
}

func (s *Store) record(ctx context.Context, companyID, title, description, tone string, now time.Time) error {
	id, err := newID()
	if err != nil {
		return err
	}
	_, err = s.collection(activityCollection).InsertOne(ctx, storedActivity{
		ID:          id,
		CompanyID:   companyID,
		Title:       title,
		Description: description,
		Tone:        tone,
		CreatedAt:   now.UTC(),
	})
	return err
}

func newID() (string, error) {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", raw[0:4], raw[4:6], raw[6:8], raw[8:10], raw[10:16]), nil
}
