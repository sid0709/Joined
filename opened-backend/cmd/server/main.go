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

	"github.com/sid0709/OpenSeat/opened-backend/internal/config"
	"github.com/sid0709/OpenSeat/opened-backend/internal/database"
	"github.com/sid0709/OpenSeat/opened-backend/internal/httpapi"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
	"github.com/sid0709/OpenSeat/opened-backend/internal/openai"
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
	reader := openai.New(cfg.OpenAIAPIKey, cfg.OpenAIModel, cfg.OpenAIBaseURL)
	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpapi.New(store, reader, cfg.AdminOrigins),
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
