// Package platform opens the shared database and builds every domain store over
// it. Each service builds the same stores, so rules that cross domains (deleting
// an account, the job catalog behind an application) behave the same whichever
// service runs them.
package platform

import (
	"context"
	"fmt"

	"github.com/sid0709/OpenSeat/backend-core/aisettings"
	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/database"
	"github.com/sid0709/OpenSeat/backend-core/employer"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobscam"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
	"github.com/sid0709/OpenSeat/backend-core/scout"
	"github.com/sid0709/OpenSeat/backend-core/staff"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// Platform is a database connection and the stores built over it.
type Platform struct {
	client *mongo.Client

	Jobs     *jobs.Store
	Accounts *auth.Store
	People   *candidate.Store
	Hiring   *employer.Store
	Scouts   *scout.Store
	Staff    *staff.Store
	// AISettings holds the OpenAI settings staff save for Acorn.
	AISettings *aisettings.Store
	// DeepSeekSettings holds the DeepSeek settings staff save for admin analysis.
	DeepSeekSettings *aisettings.Store
	// KillSwitches are runtime feature toggles. Env is the default; Mongo can override.
	KillSwitches *killswitch.Store
	// ScamHolds scores jobs at publish time and queues risky ones for staff.
	ScamHolds *jobscam.Service
}

// Options are the parts of the platform only some services configure.
type Options struct {
	// Calendar connects job hunters' Google calendars. Nil leaves it unconfigured.
	Calendar *candidate.Google
	// SettingsKey is the base64 AES-256 key that seals secrets saved in the database
	// (SETTINGS_ENCRYPTION_KEY). Blank leaves saving a secret unavailable.
	SettingsKey string
	// EnsureSearchIndex controls whether the job search text index is created at startup.
	// Defaults to false; enable in dev environments via SEARCH_ENSURE_INDEX=true.
	EnsureSearchIndex bool
}

// Open connects to the database, builds every store, and ensures their indexes.
func Open(ctx context.Context, db config.Database, opts Options) (*Platform, error) {
	client, err := database.Connect(ctx, db.MongoURI)
	if err != nil {
		return nil, fmt.Errorf("mongo: %w", err)
	}
	box, err := aisettings.NewBox(opts.SettingsKey)
	if err != nil {
		_ = client.Disconnect(ctx)
		return nil, err
	}
	calendar := opts.Calendar
	if calendar == nil {
		calendar = &candidate.Google{}
	}

	listings := jobs.NewStore(client, db.SourceDB, db.SourceCollection, db.DestDB, db.DestCollection, db.JobsCollection, db.SourceCompanies, db.CompaniesCollection, db.TempCompaniesCollection)
	scamHolds := jobscam.NewService(jobscam.NewStore(client, db.DestDB), listings, jobscam.LoadConfig())
	listings.SetScamHolds(scamHolds)
	accounts := auth.NewStore(client, db.DestDB, db.CompaniesCollection)
	people := candidate.NewStore(client, db.DestDB, newJobsCatalog(listings), accounts, calendar)
	hiring := employer.NewStore(client, db.DestDB, listings, people, accounts)
	scouts := scout.NewStore(client, db.DestDB, accounts, listings, people, scout.NewHTTPFetcher())
	moderation := staff.NewStore(client, db.DestDB, db.CompaniesCollection, listings)
	accounts.SetUserData(newAccountEraser(people, scouts, listings, hiring))
	listings.SetCompanyRefs(companiesInUse(accounts, scouts))

	p := &Platform{
		client:   client,
		Jobs:     listings,
		Accounts: accounts,
		People:   people,
		Hiring:   hiring,
		Scouts:   scouts,
		Staff:    moderation,

		AISettings:       aisettings.NewStore(client, db.DestDB, box),
		DeepSeekSettings: aisettings.NewStoreFor(client, db.DestDB, box, aisettings.DocumentDeepSeek),
		KillSwitches:     killswitch.NewStore(client, db.DestDB, killswitch.LoadDefaults()),
		ScamHolds:        scamHolds,
	}
	if err := p.ensureIndexes(ctx); err != nil {
		p.Close()
		return nil, err
	}
	if opts.EnsureSearchIndex {
		if err := listings.EnsureSearchIndexes(ctx); err != nil {
			p.Close()
			return nil, fmt.Errorf("jobs search indexes: %w", err)
		}
		if err := listings.EnsureDedupeIndexes(ctx); err != nil {
			p.Close()
			return nil, fmt.Errorf("jobs dedupe indexes: %w", err)
		}
	}
	return p, nil
}

func (p *Platform) ensureIndexes(ctx context.Context) error {
	indexed := []struct {
		name  string
		store interface{ EnsureIndexes(context.Context) error }
	}{
		{"auth", p.Accounts},
		{"candidate", p.People},
		{"employer", p.Hiring},
		{"staff", p.Staff},
		{"scout", p.Scouts},
		{"jobscam", p.ScamHolds},
	}
	for _, item := range indexed {
		if err := item.store.EnsureIndexes(ctx); err != nil {
			return fmt.Errorf("%s indexes: %w", item.name, err)
		}
	}
	return nil
}

// Mongo returns the shared database client.
func (p *Platform) Mongo() *mongo.Client {
	return p.client
}

// Close disconnects from the database.
func (p *Platform) Close() {
	_ = p.client.Disconnect(context.Background())
}
