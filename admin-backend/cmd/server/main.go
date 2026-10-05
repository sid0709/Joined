// Command server runs the admin API for the admin-frontend console.
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/sid0709/OpenSeat/admin-backend/internal/httpapi"
	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/deepseek"
	"github.com/sid0709/OpenSeat/backend-core/google"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
	"github.com/sid0709/OpenSeat/backend-core/openai"
	"github.com/sid0709/OpenSeat/backend-core/platform"
)

const (
	defaultHTTPAddr = "127.0.0.1:8081"
	backfillTimeout = 2 * time.Minute
	dropTimeout     = 30 * time.Second
	// DeepSeek does not rate-limit by request count, so both AI steps run wide. A
	// research answer waits on web searches for most of its time, so many run at once.
	defaultAnalyzeWorkers  = 64
	defaultResearchWorkers = 128
)

var defaultOrigins = []string{"http://127.0.0.1:6010", "http://localhost:6010"}

func main() {
	config.LoadEnvFile()
	db, err := config.LoadDatabase()
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}
	server, err := config.LoadHTTP(defaultHTTPAddr, defaultOrigins)
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}
	ai := config.LoadOpenAI()
	deepSeekEnv := config.LoadDeepSeek()
	googleConfig := config.LoadGoogle()
	staffDomain := config.Env("ADMIN_GOOGLE_DOMAIN", "")
	adminToken := config.Env("ADMIN_API_TOKEN", "")
	analyzerToken := config.Env("ANALYZER_API_TOKEN", "")
	crawlerToken := config.Env("CRAWLER_INGEST_TOKEN", "")

	p, err := platform.Open(context.Background(), db, platform.Options{SettingsKey: config.Env("SETTINGS_ENCRYPTION_KEY", "")})
	if err != nil {
		slog.Error("platform", "error", config.Redact(err, db.MongoURI))
		os.Exit(1)
	}
	defer p.Close()
	// In the background, so the console can reach the API while it runs.
	go migrateCatalog(p.Jobs, db.MongoURI)

	if adminToken == "" {
		slog.Warn("ADMIN_API_TOKEN is not set: staff endpoints accept unauthenticated requests")
	}
	if analyzerToken == "" {
		slog.Warn("ANALYZER_API_TOKEN is not set: public analyzer routes are disabled")
	}
	if crawlerToken == "" {
		slog.Warn("CRAWLER_INGEST_TOKEN is not set: the crawler extension cannot stage jobs")
	}
	reporter := httpkit.NewReporter(config.LoadErrorReporting().SentryDSN)
	reader := openai.New(ai.APIKey, ai.Model, ai.BaseURL)
	staff := httpapi.StaffSignIn{
		Accounts:    p.Accounts,
		OAuth:       &google.Client{ClientID: googleConfig.ClientID, ClientSecret: googleConfig.ClientSecret},
		RedirectURL: googleConfig.SignInRedirectURL,
		Domain:      staffDomain,
	}
	switch {
	case !staff.Required():
		slog.Warn("Google sign-in is not set up: the console does not ask staff to sign in")
	case staffDomain == "":
		slog.Error("ADMIN_GOOGLE_DOMAIN is not set: no Google account can sign in to the console")
	}
	migrationAI := deepseek.NewReloading(p.DeepSeekSettings, deepSeekEnv)
	if !migrationAI.Ready() {
		slog.Warn("no DeepSeek key yet: save one under Settings → DeepSeek, or set DEEPSEEK_API_KEY, before analyzing or researching")
	}
	importCfg := config.LoadJobImport()
	importRegistry := jobs.NewSourceRegistry()
	importRegistry.Register(jobs.NewAthensSource(p.Jobs, importCfg.SourceEnabled(jobs.AthensSourceID)))
	importLog := jobs.NewStoreRunLog(p.Jobs, importCfg.RunsCollection)
	if err := p.Jobs.EnsureImportIndexes(context.Background(), importCfg.RunsCollection); err != nil {
		slog.Error("import indexes", "error", config.Redact(err, db.MongoURI))
	}
	importGate := jobs.LookupImportKillSwitch()
	if importGate == nil {
		importGate = jobImportsGate(p.KillSwitches)
	}
	importRunner := jobs.NewRunner(jobs.RunnerOptions{
		Enabled:  importCfg.Enabled,
		Interval: importCfg.Interval,
		Timeout:  importCfg.RunTimeout,
		Registry: importRegistry,
		Lock:     jobs.NewStoreImportLock(p.Jobs, importCfg.LocksCollection, importCfg.RunTimeout),
		Log:      importLog,
		Gate:     importGate,
		Sink:     p.Jobs,
		Pool:     p.Jobs,
	})
	go importRunner.Start(context.Background())

	handler := httpapi.New(p.Jobs, p.Scouts, p.Staff, reader, httpapi.Options{
		Origins:       server.Origins,
		AdminToken:    adminToken,
		AnalyzerToken: analyzerToken,
		CrawlerToken:  crawlerToken,
		Staff:         staff,
		AcornAI:       p.AISettings,
		AcornAIEnv:    ai,
		DeepSeek:      p.DeepSeekSettings,
		DeepSeekEnv:   deepSeekEnv,
		Migration: httpapi.MigrationOptions{
			Model:           migrationAI,
			AnalyzeWorkers:  config.EnvInt("MIGRATION_ANALYZE_WORKERS", defaultAnalyzeWorkers),
			ResearchWorkers: config.EnvInt("MIGRATION_RESEARCH_WORKERS", defaultResearchWorkers),
		},
		Import: httpapi.ImportOptions{
			Enabled:     importCfg.Enabled,
			Sources:     importRegistry.Status(),
			RecentLimit: importCfg.RecentLimit,
			Runs:        importLog,
		},
		KillSwitches: p.KillSwitches,
		ScamHolds:    p.ScamHolds,
	})
	if err := httpkit.Serve("admin api", server.Addr, httpkit.Wrap(slog.Default(), reporter, handler)); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}

// migrateCatalog brings stored jobs and companies up to the current shape. Staff
// own the catalog, so the admin API runs these. Each is idempotent and safe to run
// beside requests; a failure is logged and the server keeps serving.
func migrateCatalog(store *jobs.Store, mongoURI string) {
	backfillCtx, cancelBackfill := context.WithTimeout(context.Background(), backfillTimeout)
	updated, err := store.BackfillJobProvenance(backfillCtx)
	cancelBackfill()
	if err != nil {
		slog.Error("backfill job provenance", "error", config.Redact(err, mongoURI))
	} else {
		slog.Info("backfill job provenance", "updated", updated)
	}
	purgeCtx, cancelPurge := context.WithTimeout(context.Background(), backfillTimeout)
	purged, err := store.PurgePublishedTemp(purgeCtx)
	cancelPurge()
	if err != nil {
		slog.Error("purge published temp rows", "error", config.Redact(err, mongoURI))
	} else if purged.Jobs+purged.Companies > 0 {
		slog.Info("purge published temp rows", "jobs", purged.Jobs, "companies", purged.Companies)
	}
	dropCtx, cancelDrop := context.WithTimeout(context.Background(), dropTimeout)
	dropped, err := store.DropCompanyLeadership(dropCtx)
	cancelDrop()
	if err != nil {
		slog.Error("drop company leadership", "error", config.Redact(err, mongoURI))
	} else if dropped > 0 {
		slog.Info("drop company leadership", "companies", dropped)
	}
}

type jobImportsSwitch struct {
	switches killswitch.Switches
}

func jobImportsGate(switches killswitch.Switches) jobs.ImportKillSwitch {
	if switches == nil {
		return nil
	}
	return jobImportsSwitch{switches: switches}
}

func (g jobImportsSwitch) Allow(string) bool {
	return killswitch.On(g.switches, context.Background(), killswitch.JobImports)
}
