package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/config"
	"github.com/sid0709/OpenSeat/backend-core/ranking"
)

// Export file names, read by tools/ranking/train_ltr.py.
const (
	exportRows    = "train.tsv"
	exportGroups  = "train.query"
	exportColumns = "features.txt"
)

// runExport writes one TSV row per shown job (label, then the feature vector) and
// a LightGBM query file with the size of each page, for lambdarank training.
func runExport(ctx context.Context, args []string) error {
	flags := flag.NewFlagSet("export", flag.ExitOnError)
	since := flags.Duration("since", 30*24*time.Hour, "how far back to read impressions")
	out := flags.String("out", "training", "output directory")
	_ = flags.Parse(args)

	p, db, err := openPlatform(ctx)
	if err != nil {
		return err
	}
	defer p.Close()
	cfg := config.LoadRanking()
	coll := p.Mongo().Database(db.DestDB).Collection(cfg.EventsCollection)

	if err := os.MkdirAll(*out, 0o755); err != nil {
		return err
	}
	rows, err := os.Create(filepath.Join(*out, exportRows))
	if err != nil {
		return err
	}
	defer rows.Close()
	groupsFile, err := os.Create(filepath.Join(*out, exportGroups))
	if err != nil {
		return err
	}
	defer groupsFile.Close()
	rowWriter, groupWriter := bufio.NewWriter(rows), bufio.NewWriter(groupsFile)

	current, size, total := "", 0, 0
	flush := func() {
		if size > 0 {
			fmt.Fprintln(groupWriter, size)
		}
	}
	groups, err := ranking.ExportTraining(ctx, coll, time.Now().Add(-*since), func(row ranking.TrainingRow) error {
		if row.Group != current {
			flush()
			current, size = row.Group, 0
		}
		size++
		total++
		fields := make([]string, 0, len(row.Features)+1)
		fields = append(fields, strconv.Itoa(row.Label))
		for _, v := range row.Features {
			fields = append(fields, strconv.FormatFloat(float64(v), 'g', 6, 32))
		}
		_, err := fmt.Fprintln(rowWriter, strings.Join(fields, "\t"))
		return err
	})
	if err != nil {
		return err
	}
	flush()
	if err := rowWriter.Flush(); err != nil {
		return err
	}
	if err := groupWriter.Flush(); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(*out, exportColumns), []byte(strings.Join(ranking.FeatureNames[:], "\n")+"\n"), 0o644); err != nil {
		return err
	}
	fmt.Printf("exported %d rows in %d pages (feature version %s) to %s\n", total, groups, ranking.FeatureVersion, *out)
	return nil
}
