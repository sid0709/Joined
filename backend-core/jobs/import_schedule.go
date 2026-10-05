package jobs

import (
	"context"
	"log/slog"
	"time"
)

// Start ticks on Interval and runs enabled sources. When the runner is disabled
// it returns immediately so a service can call it unconditionally.
func (r *Runner) Start(ctx context.Context) {
	if r == nil || !r.enabled {
		slog.Info("job import runner disabled")
		return
	}
	if r.interval <= 0 {
		r.interval = defaultImportInterval
	}
	slog.Info("job import runner starting", "interval", r.interval.String())
	if ctx.Err() == nil {
		r.runLogged(ctx)
	}
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			slog.Info("job import runner stopped")
			return
		case <-ticker.C:
			r.runLogged(ctx)
		}
	}
}

func (r *Runner) runLogged(ctx context.Context) {
	run, err := r.Run(ctx)
	if err != nil {
		slog.Error("job import run", "error", err, "id", run.ID, "status", run.Status)
		return
	}
	slog.Info(
		"job import run",
		"id", run.ID,
		"status", run.Status,
		"fetched", run.Totals.Fetched,
		"inserted", run.Totals.Inserted,
		"replaced", run.Totals.Replaced,
		"skipped", run.Totals.Skipped,
		"failed", run.Totals.Failed,
	)
}
