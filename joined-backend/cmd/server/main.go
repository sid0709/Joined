package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sid0709/OpenSeat/joined-backend/internal/auth"
	"github.com/sid0709/OpenSeat/joined-backend/internal/candidate"
	"github.com/sid0709/OpenSeat/joined-backend/internal/config"
	"github.com/sid0709/OpenSeat/joined-backend/internal/database"
	"github.com/sid0709/OpenSeat/joined-backend/internal/employer"
	"github.com/sid0709/OpenSeat/joined-backend/internal/httpapi"
	"github.com/sid0709/OpenSeat/joined-backend/internal/jobs"
	"github.com/sid0709/OpenSeat/joined-backend/internal/openai"
	"github.com/sid0709/OpenSeat/joined-backend/internal/scout"
	"github.com/sid0709/OpenSeat/joined-backend/internal/staff"
)

const (
	readHeaderTimeout = 5 * time.Second
	writeTimeout      = 20 * time.Minute
	idleTimeout       = 2 * time.Minute
	shutdownTimeout   = 10 * time.Second
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "error", err)
		os.Exit(1)
	}

	client, err := database.Connect(context.Background(), cfg.MongoURI)
	if err != nil {
		slog.Error("mongo", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	defer client.Disconnect(context.Background())

	store := jobs.NewStore(client, cfg.SourceDB, cfg.SourceCollection, cfg.DestDB, cfg.DestCollection, cfg.JobsCollection, cfg.SourceCompanies, cfg.CompaniesCollection)
	accounts := auth.NewStore(client, cfg.DestDB, cfg.CompaniesCollection)
	if err := accounts.EnsureIndexes(context.Background()); err != nil {
		slog.Error("auth indexes", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	google := &candidate.Google{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.GoogleRedirectURL,
	}
	people := candidate.NewStore(client, cfg.DestDB, httpapi.NewJobsCatalog(store), accounts, google)
	if err := people.EnsureIndexes(context.Background()); err != nil {
		slog.Error("candidate indexes", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	hiring := employer.NewStore(client, cfg.DestDB, store, people, accounts)
	if err := hiring.EnsureIndexes(context.Background()); err != nil {
		slog.Error("employer indexes", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	backfillCtx, cancelBackfill := context.WithTimeout(context.Background(), 2*time.Minute)
	updated, err := store.BackfillJobProvenance(backfillCtx)
	cancelBackfill()
	if err != nil {
		slog.Error("backfill job provenance", "error", config.Redact(err, cfg.MongoURI))
	} else {
		slog.Info("backfill job provenance", "updated", updated)
	}
	dropCtx, cancelDrop := context.WithTimeout(context.Background(), 30*time.Second)
	dropped, err := store.DropCompanyLeadership(dropCtx)
	cancelDrop()
	if err != nil {
		slog.Error("drop company leadership", "error", config.Redact(err, cfg.MongoURI))
	} else if dropped > 0 {
		slog.Info("drop company leadership", "companies", dropped)
	}
	scouts := scout.NewStore(client, cfg.DestDB, accounts, store, people, scout.NewHTTPFetcher())
	moderation := staff.NewStore(client, cfg.DestDB, cfg.CompaniesCollection, store)
	if err := moderation.EnsureIndexes(context.Background()); err != nil {
		slog.Error("staff indexes", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	accounts.SetUserData(httpapi.NewAccountEraser(people, scouts, store, hiring))
	if err := scouts.EnsureIndexes(context.Background()); err != nil {
		slog.Error("scout indexes", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}
	if resumed, err := scouts.ResumePending(context.Background()); err != nil {
		slog.Error("resume scout checks", "error", config.Redact(err, cfg.MongoURI))
	} else if resumed > 0 {
		slog.Info("resume scout checks", "submissions", resumed)
	}
	if cfg.AdminAPIToken == "" {
		slog.Warn("ADMIN_API_TOKEN is not set: staff endpoints accept unauthenticated requests")
	}
	reader := openai.New(cfg.OpenAIAPIKey, cfg.OpenAIModel, cfg.OpenAIBaseURL).WithSearchModel(cfg.OpenAISearchModel)
	server := &http.Server{
		Addr: cfg.HTTPAddr,
		Handler: httpapi.New(store, accounts, people, scouts, hiring, moderation, reader, httpapi.Options{
			Origins:    cfg.AdminOrigins,
			Frontend:   cfg.FrontendOrigin,
			AdminToken: cfg.AdminAPIToken,
		}),
		ReadHeaderTimeout: readHeaderTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("shutdown", "error", err)
		}
	}()

	slog.Info("admin api listening", "addr", cfg.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}
