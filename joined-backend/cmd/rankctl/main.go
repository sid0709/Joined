// Command rankctl operates personalized job ranking: rebuild the vector index
// behind its alias, score the golden set, export training data for the learned
// ranker, load-test the search API, and benchmark ranking on a synthetic catalog.
//
//	rankctl reindex  -version v2 [-drop-old]
//	rankctl eval     [-baseline eval.json] [-out eval.json] [-max-drop 0.02]
//	rankctl export   [-since 720h] [-out ./training]
//	rankctl loadtest -url http://127.0.0.1:8080 [-rps 100] [-duration 30s] [-p95 50ms]
//	rankctl synth    [-jobs 200000] [-searches 300]
//
// It reads the same environment as the server (MONGO_URI, QDRANT_URL, EMBEDDER_URL, ...).
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/platform"
	"github.com/sid0709/Joined/backend-core/ranking"
)

type command struct {
	summary string
	run     func(ctx context.Context, args []string) error
}

var commands = map[string]command{
	"reindex":  {"build a new jobs collection version and move the alias to it", runReindex},
	"eval":     {"score the golden set (NDCG@10, recall) against the live index", runEval},
	"export":   {"write labeled impressions for training the learned ranker", runExport},
	"loadtest": {"drive the search API at a steady rate and report latency", runLoadTest},
	"synth":    {"rank a synthetic catalog end to end and report latency", runSynth},
}

func main() {
	config.LoadEnvFile()
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	cmd, ok := commands[os.Args[1]]
	if !ok {
		usage()
		os.Exit(2)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := cmd.run(ctx, os.Args[2:]); err != nil {
		slog.Error("rankctl "+os.Args[1], "error", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: rankctl <command> [flags]")
	for _, name := range []string{"reindex", "eval", "export", "loadtest", "synth"} {
		fmt.Fprintf(os.Stderr, "  %-9s %s\n", name, commands[name].summary)
	}
}

// openPlatform connects to Mongo the way the server does.
func openPlatform(ctx context.Context) (*platform.Platform, config.Database, error) {
	db, err := config.LoadDatabase()
	if err != nil {
		return nil, db, err
	}
	p, err := platform.Open(ctx, db, platform.Options{})
	if err != nil {
		return nil, db, fmt.Errorf("platform: %s", config.Redact(err, db.MongoURI))
	}
	return p, db, nil
}

// newService builds a ranking service without event logging (tools never log impressions).
func newService(cfg config.Ranking, profiles ranking.ProfileSource) (*ranking.Service, error) {
	cfg.Events = false
	return ranking.NewService(ranking.Options{Config: cfg, Profiles: profiles, Logger: slog.Default()})
}
