package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/sid0709/Joined/backend-core/config"
	"github.com/sid0709/Joined/backend-core/ranking"
)

func runReindex(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("reindex", flag.ExitOnError)
	version := flags.String("version", "", "new collection version, e.g. v2 (required)")
	dropOld := flags.Bool("drop-old", false, "delete the previous version after the alias moves")
	_ = flags.Parse(args)
	if *version == "" {
		return errors.New("-version is required")
	}
	p, _, err := openPlatform(ctx)
	if err != nil {
		return err
	}
	defer p.Close()
	svc, err := newService(config.LoadRanking(), nil)
	if err != nil {
		return err
	}
	return svc.Reindex(ctx, p.Jobs, *version, *dropOld)
}

func runEval(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("eval", flag.ExitOnError)
	baseline := flags.String("baseline", "", "a previous report; fail when mean NDCG drops more than -max-drop")
	out := flags.String("out", "", "write this run's report here (JSON)")
	maxDrop := flags.Float64("max-drop", 0.02, "largest allowed drop in mean NDCG@10 against the baseline")
	only := flags.String("case", "", "run only cases whose name contains this")
	verbose := flags.Bool("verbose", false, "print each case's first page with its grades")
	explain := flags.Bool("explain", false, "with -verbose, print each listed job's score and features")
	_ = flags.Parse(args)

	p, _, err := openPlatform(ctx)
	if err != nil {
		return err
	}
	defer p.Close()
	svc, err := newService(config.LoadRanking(), nil)
	if err != nil {
		return err
	}
	if err := svc.Load(ctx, p.Jobs); err != nil {
		return err
	}
	cases, err := ranking.GoldenSet()
	if err != nil {
		return err
	}
	if *only != "" {
		kept := cases[:0]
		for _, c := range cases {
			if strings.Contains(c.Name, *only) {
				kept = append(kept, c)
			}
		}
		cases = kept
	}
	report, err := svc.Evaluate(ctx, cases)
	if err != nil {
		return err
	}
	for _, c := range report.Cases {
		if c.Skipped != "" {
			fmt.Printf("%-48s skipped: %s\n", c.Name, c.Skipped)
			continue
		}
		fmt.Printf("%-48s ndcg@%d %.3f  recall@%d %.3f  (%d relevant, %d returned)\n",
			c.Name, ranking.EvalNDCGDepth, c.NDCG, ranking.EvalRecallDepth, c.Recall, c.Relevant, c.Returned)
		if *verbose {
			golden := goldenByName(cases, c.Name)
			jobs := svc.Index().Lookup(c.Top)
			for i, id := range c.Top {
				if job, ok := jobs[id]; ok {
					fmt.Printf("    %2d. [%d] %-60s %v\n", i+1, golden.Grade(job), job.Title, job.Occupations)
					if *explain {
						fmt.Printf("        %s\n", c.Explain[id])
					}
				}
			}
			fmt.Printf("    first top-grade job at rank %d\n", c.FirstBest)
			if *explain {
				for id, text := range c.Explain {
					if !containsID(c.Top, id) {
						if job, ok := svc.Index().Get(id); ok {
							fmt.Printf("    best: %s %v\n        %s\n", job.Title, job.Occupations, text)
						}
					}
				}
			}
		}
	}
	fmt.Printf("\nmean ndcg@%d %.4f  mean recall@%d %.4f  model %s\n",
		ranking.EvalNDCGDepth, report.MeanNDCG, ranking.EvalRecallDepth, report.MeanRecall, report.Model)

	if *out != "" {
		encoded, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(*out, encoded, 0o644); err != nil {
			return err
		}
	}
	if *baseline != "" {
		raw, err := os.ReadFile(*baseline)
		if err != nil {
			return err
		}
		var before ranking.EvalReport
		if err := json.Unmarshal(raw, &before); err != nil {
			return fmt.Errorf("read baseline: %w", err)
		}
		if drop := before.MeanNDCG - report.MeanNDCG; drop > *maxDrop {
			return fmt.Errorf("mean NDCG@%d fell %.4f (from %.4f to %.4f), more than %.4f",
				ranking.EvalNDCGDepth, drop, before.MeanNDCG, report.MeanNDCG, *maxDrop)
		}
		fmt.Printf("baseline %.4f → %.4f: within %.4f\n", before.MeanNDCG, report.MeanNDCG, *maxDrop)
	}
	return nil
}

func goldenByName(cases []ranking.GoldenCase, name string) ranking.GoldenCase {
	for _, c := range cases {
		if c.Name == name {
			return c
		}
	}
	return ranking.GoldenCase{}
}

func containsID(ids []string, id string) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}
