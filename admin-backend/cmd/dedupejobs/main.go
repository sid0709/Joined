// Command dedupejobs reports active job listings that look like the same opening.
// It never writes. Pass -dry-run (the default) to print duplicate groups.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"log/slog"
	"os"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/database"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const reportTimeout = 5 * time.Minute

func main() {
	dryRun := flag.Bool("dry-run", true, "report duplicate groups without writing")
	titleSimilarity := flag.Float64("title-similarity", 0, "fuzzy title cutoff; 0 uses the default")
	flag.Parse()
	if !*dryRun {
		slog.Error("dedupejobs only reports duplicates; pass -dry-run")
		os.Exit(1)
	}

	config.LoadEnvFile()
	cfg, err := config.LoadDatabase()
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

	store := jobs.NewStore(
		client,
		cfg.SourceDB,
		cfg.SourceCollection,
		cfg.DestDB,
		cfg.DestCollection,
		cfg.JobsCollection,
		cfg.SourceCompanies,
		cfg.CompaniesCollection,
		cfg.TempCompaniesCollection,
	)
	ctx, cancel := context.WithTimeout(context.Background(), reportTimeout)
	defer cancel()

	dedupe := jobs.DefaultDedupeConfig()
	if *titleSimilarity > 0 {
		dedupe.TitleSimilarity = *titleSimilarity
	}

	slog.Info("reporting duplicate jobs", "dry-run", true, "destination", cfg.DestDB+"."+cfg.JobsCollection)
	groups, err := store.ReportDuplicateGroups(ctx, dedupe)
	if err != nil {
		slog.Error("report failed", "error", config.Redact(err, cfg.MongoURI))
		os.Exit(1)
	}

	payload, err := json.MarshalIndent(groups, "", "  ")
	if err != nil {
		slog.Error("encode report", "error", err)
		os.Exit(1)
	}
	os.Stdout.Write(append(payload, '\n'))
	slog.Info("dry-run finished", "groups", len(groups), "wrote", false)
}
