package main

import (
	"context"
	"flag"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/sid0709/Joined/backend-core/candidate"
	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/ranking"
)

// Synthetic runs use their own collections, so they never touch the real index.
const (
	synthJobsCollection  = "synthjobs"
	synthUsersCollection = "synthusers"
)

// runSynth builds a synthetic catalog in Qdrant (hash vectors, no model) and in
// memory, then times uncached searches of every kind through the full pipeline:
// filters, vector retrieval, features, scoring, re-ranking.
func runSynth(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("synth", flag.ExitOnError)
	jobCount := flags.Int("jobs", 200_000, "synthetic jobs to index")
	searches := flags.Int("searches", 300, "searches to time")
	keep := flags.Bool("keep", false, "keep the synthetic collections afterwards")
	settle := flags.Bool("settle", true, "wait for Qdrant to finish building the index before timing")
	warmup := flags.Int("warmup", 100, "untimed searches first, so caches are as warm as a running server's")
	_ = flags.Parse(args)

	cfg := config.LoadRanking()
	if cfg.QdrantURL == "" {
		return fmt.Errorf("QDRANT_URL is required")
	}
	cfg.JobsCollection, cfg.UsersCollection = synthJobsCollection, synthUsersCollection
	cfg.RedisURL = ""
	version := "n" + strconv.Itoa(*jobCount)
	cfg.CollectionVersion = version

	cases, err := ranking.GoldenSet()
	if err != nil {
		return err
	}
	profiles := map[string]candidate.Profile{}
	for i, c := range cases {
		if c.Profile != nil {
			profiles["synth-"+strconv.Itoa(i)] = *c.Profile
		}
	}
	svc, err := ranking.NewService(ranking.Options{
		Config:   cfg,
		Profiles: staticProfiles(profiles),
		Embedder: ranking.HashEmbedder{Dims: cfg.EmbedderDimensions},
	})
	if err != nil {
		return err
	}
	source := ranking.SyntheticSource{N: *jobCount, Seed: 1, Now: time.Now()}
	started := time.Now()
	if err := svc.Reindex(ctx, source, version, false); err != nil {
		return err
	}
	fmt.Printf("indexed %d synthetic jobs into %s_%s in %s\n", *jobCount, synthJobsCollection, version, time.Since(started).Round(time.Second))
	if !*keep {
		defer svc.DropCollections(context.WithoutCancel(ctx), version)
	}
	// The users collection holds the synthetic profiles' vectors for the run.
	if err := svc.EnsureCollections(ctx); err != nil {
		return err
	}
	if err := svc.Load(ctx, source); err != nil {
		return err
	}
	if *settle {
		started := time.Now()
		if err := svc.WaitOptimized(ctx); err != nil {
			return err
		}
		fmt.Printf("index optimized in %s\n", time.Since(started).Round(time.Second))
	}

	filters := []ranking.Filter{{}, {Workplaces: []ranking.Workplace{ranking.WorkplaceRemote}}, {PayMinUSD: 150_000}, {PostedAfter: time.Now().Add(-7 * 24 * time.Hour)}}
	byMode := map[string][]float64{}
	stages := map[string]map[string][]float64{}
	for i := -*warmup; i < *searches; i++ {
		c := cases[(i+*warmup)%len(cases)]
		n := i + *warmup
		req := ranking.Request{Query: c.Query, Filter: filters[n%len(filters)], Sort: ranking.SortRelevance, NoCache: true, Now: time.Now()}
		if c.Profile != nil {
			req.UserID, req.Sort = "synth-"+strconv.Itoa(n%len(cases)), ranking.SortRecommended
		}
		res, err := svc.Search(ctx, req)
		if err != nil {
			return fmt.Errorf("search %d (%s): %w", i, c.Name, err)
		}
		if i < 0 {
			continue
		}
		byMode[res.Mode] = append(byMode[res.Mode], res.Timing["total"])
		if stages[res.Mode] == nil {
			stages[res.Mode] = map[string][]float64{}
		}
		for stage, took := range res.Timing {
			stages[res.Mode][stage] = append(stages[res.Mode][stage], took)
		}
	}
	for _, mode := range []string{ranking.ModeQuery, ranking.ModeProfile, ranking.ModeAnonymous} {
		v := byMode[mode]
		if len(v) == 0 {
			continue
		}
		sort.Float64s(v)
		fmt.Printf("%-9s n=%-4d p50 %6.1fms  p95 %6.1fms  p99 %6.1fms\n", mode, len(v), pctF(v, 50), pctF(v, 95), pctF(v, 99))
		names := make([]string, 0, len(stages[mode]))
		for stage := range stages[mode] {
			names = append(names, stage)
		}
		sort.Strings(names)
		for _, stage := range names {
			times := stages[mode][stage]
			sort.Float64s(times)
			fmt.Printf("    %-9s p50 %6.1fms  p95 %6.1fms\n", stage, pctF(times, 50), pctF(times, 95))
		}
	}
	return nil
}

type staticProfiles map[string]candidate.Profile

func (p staticProfiles) GetProfile(_ context.Context, userID string, _ time.Time) (candidate.Profile, error) {
	return p[userID], nil
}
