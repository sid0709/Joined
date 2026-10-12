// Command server runs the Joined API for joined-frontend.
package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	// Interview times are kept in each job hunter's own zone, so the binary carries
	// the zone database instead of relying on the container's.
	_ "time/tzdata"

	"github.com/sid0709/Joined/backend-core/auth"
	"github.com/sid0709/Joined/backend-core/billing"
	"github.com/sid0709/Joined/backend-core/candidate"
	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/google"
	"github.com/sid0709/Joined/backend-core/httpkit"
	"github.com/sid0709/Joined/backend-core/jobs"
	"github.com/sid0709/Joined/backend-core/metrics"
	"github.com/sid0709/Joined/backend-core/monitoring"
	"github.com/sid0709/Joined/backend-core/openai"
	"github.com/sid0709/Joined/backend-core/platform"
	"github.com/sid0709/Joined/backend-core/ranking"
	"github.com/sid0709/Joined/backend-core/savedsearch"
	"github.com/sid0709/Joined/backend-core/statuspage"
	"github.com/sid0709/Joined/joined-backend/internal/httpapi"
)

const (
	defaultHTTPAddr       = "127.0.0.1:8080"
	defaultFrontendOrigin = "http://localhost:6002"
	companyModeEnv        = "COMPANY_MODE_ENABLED"
)

var defaultOrigins = []string{"http://127.0.0.1:6002", "http://localhost:6002"}

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
	frontend := strings.TrimRight(config.Env("FRONTEND_ORIGIN", defaultFrontendOrigin), "/")
	googleConfig := config.LoadGoogle()
	oauth := &google.Client{ClientID: googleConfig.ClientID, ClientSecret: googleConfig.ClientSecret}
	calendar := &candidate.Google{OAuth: oauth, RedirectURL: config.Env("GOOGLE_REDIRECT_URL", "")}

	emailConfig := config.LoadEmail(frontend)
	emailSender, err := auth.NewEmailSender(emailConfig)
	if err != nil {
		slog.Error("email config", "error", err)
		os.Exit(1)
	}

	p, err := platform.Open(context.Background(), db, platform.Options{
		Calendar:          calendar,
		EnsureSearchIndex: config.SearchEnsureIndex(),
	})
	if err != nil {
		slog.Error("platform", "error", config.Redact(err, db.MongoURI))
		os.Exit(1)
	}
	defer p.Close()

	expiryCfg := jobs.LoadExpiryConfig()
	if expiryCfg.Enabled {
		runner := jobs.NewExpiryRunner(p.Jobs, expiryCfg, slog.Default())
		go runner.Run(context.Background())
		slog.Info("jobs expiry checker enabled")
	}

	reporter := httpkit.NewReporter(config.LoadErrorReporting().SentryDSN)
	reader := openai.New(ai.APIKey, ai.Model, ai.BaseURL).WithSearchModel(ai.SearchModel)
	premium, webhook, err := openBilling(billing.NewMongoStore(p.Mongo(), db.DestDB))
	if err != nil {
		slog.Error("billing config", "error", err)
		os.Exit(1)
	}
	ranker, events, err := openRanking(context.Background(), p, db.DestDB)
	if err != nil {
		slog.Error("ranking config", "error", err)
		os.Exit(1)
	}
	if events != nil {
		defer events.Close()
	}
	searches := savedsearch.NewMongoStore(p.Mongo(), db.DestDB)
	if err := searches.EnsureIndexes(context.Background()); err != nil {
		slog.Error("saved search indexes", "error", err)
		os.Exit(1)
	}
	handler := httpapi.New(p.Jobs, p.Accounts, p.People, p.Hiring, p.Staff, reader, httpapi.Options{
		Origins:           server.Origins,
		Frontend:          frontend,
		Google:            oauth,
		GoogleRedirectURL: googleConfig.SignInRedirectURL,
		CompanyMode:       companyModeEnabled(config.Env(companyModeEnv, "")),
		EmailSender:       emailSender,
		KillSwitches:      p.KillSwitches,
		Billing:           premium,
		BillingWebhook:    webhook,
		SavedSearches:     searches,
		Ranking:           ranker,
		Status:            openStatusPage(context.Background(), p),
	})
	metrics.Serve(config.MetricsAddr())
	if err := httpkit.Serve("joined api", server.Addr, httpkit.Wrap(slog.Default(), reporter, handler)); err != nil {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}

// openRanking builds personalized search and starts its index sync. The in-memory
// index always loads; Qdrant, Redis, and the embedder join when configured.
func openRanking(ctx context.Context, p *platform.Platform, destDB string) (*ranking.Service, *ranking.MongoEventLog, error) {
	cfg := config.LoadRanking()
	var events *ranking.MongoEventLog
	var log ranking.EventLog
	if cfg.Events {
		events = ranking.NewMongoEventLog(p.Mongo(), destDB, cfg.EventsCollection, slog.Default())
		if err := events.EnsureIndexes(ctx); err != nil {
			slog.Warn("ranking event indexes", "error", err)
		}
		log = events
	}
	svc, err := ranking.NewService(ranking.Options{Config: cfg, Profiles: p.People, Events: log, Logger: slog.Default()})
	if err != nil {
		if events != nil {
			events.Close()
		}
		return nil, nil, err
	}
	if cfg.Indexer {
		if err := svc.EnsureCollections(ctx); err != nil {
			slog.Warn("ranking collections", "error", err)
		}
	}
	go svc.Run(ctx, p.Jobs)
	slog.Info("ranking enabled", "qdrant", cfg.QdrantURL != "", "embedder", cfg.EmbedderURL != "", "redis", cfg.RedisURL != "", "indexer", cfg.Indexer, "ltrPercent", cfg.LTRPercent)
	return svc, events, nil
}

func openBilling(store billing.Store) (*billing.Service, *billing.WebhookRouter, error) {
	if config.Env("STRIPE_SECRET_KEY", "") == "" {
		return nil, nil, nil
	}
	cfg, err := billing.LoadConfig()
	if err != nil {
		return nil, nil, err
	}
	svc := billing.NewService(billing.NewHTTPClient(cfg.SecretKey), store, cfg)
	router := billing.NewWebhookRouter(cfg.WebhookSecret, billing.NewMemoryIdempotencyStore())
	return svc, router, nil
}

func companyModeEnabled(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true", "1":
		return true
	default:
		return false
	}
}

// openStatusPage builds the public status page. With PROMETHEUS_URL set it also
// records each day's uptime; without it the page shows incidents only.
func openStatusPage(ctx context.Context, p *platform.Platform) *statuspage.Service {
	var prom monitoring.Querier
	if client := monitoring.NewPrometheus(config.PrometheusURL()); client != nil {
		prom = client
		go statuspage.NewRecorder(client, p.StatusPage, slog.Default()).Run(ctx)
	}
	return statuspage.NewService(prom, p.StatusPage, slog.Default())
}
