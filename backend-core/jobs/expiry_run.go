package jobs

import (
	"context"
	"errors"
	"log/slog"
	"time"
)

type expirySource interface {
	ListDueExpiryJobs(ctx context.Context, now time.Time, cfg ExpiryConfig) ([]expiryJob, error)
	SaveExpiryCheck(ctx context.Context, job expiryJob) error
}

// ExpiryRunner rechecks due apply links on a timer. It does nothing unless Enabled.
type ExpiryRunner struct {
	source  expirySource
	checker *LinkChecker
	cfg     ExpiryConfig
	log     *slog.Logger
	now     func() time.Time
}

func NewExpiryRunner(store *Store, cfg ExpiryConfig, log *slog.Logger) *ExpiryRunner {
	return newExpiryRunner(store, NewLinkChecker(cfg), cfg, log)
}

func newExpiryRunner(source expirySource, checker *LinkChecker, cfg ExpiryConfig, log *slog.Logger) *ExpiryRunner {
	cfg = cfg.withDefaults()
	if log == nil {
		log = slog.Default()
	}
	if checker == nil {
		checker = NewLinkChecker(cfg)
	}
	return &ExpiryRunner{
		source:  source,
		checker: checker,
		cfg:     cfg,
		log:     log,
		now:     time.Now,
	}
}

func (r *ExpiryRunner) Run(ctx context.Context) {
	if r == nil || !r.cfg.Enabled {
		return
	}
	if err := r.RunOnce(ctx); err != nil && !errors.Is(err, context.Canceled) {
		r.log.Error("expiry check", "error", err)
	}
	ticker := time.NewTicker(r.cfg.PollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := r.RunOnce(ctx); err != nil && !errors.Is(err, context.Canceled) {
				r.log.Error("expiry check", "error", err)
			}
		}
	}
}

func (r *ExpiryRunner) RunOnce(ctx context.Context) error {
	if r == nil || r.source == nil {
		return nil
	}
	nowFn := r.now
	if nowFn == nil {
		nowFn = time.Now
	}
	now := nowFn()
	jobs, err := r.source.ListDueExpiryJobs(ctx, now, r.cfg)
	if err != nil {
		return err
	}
	for _, job := range jobs {
		if err := ctx.Err(); err != nil {
			return err
		}
		result := r.checker.Check(ctx, job.ApplyLink)
		updated := applyLinkCheck(job, result, now, r.cfg.FailureThreshold)
		if err := r.source.SaveExpiryCheck(ctx, updated); err != nil {
			r.log.Error("save expiry check", "job", job.ID, "error", err)
			continue
		}
		if updated.ListingStatus == ListingExpired && job.ListingStatus != ListingExpired {
			r.log.Info("expired job", "job", job.ID, "signal", updated.LinkCheckSignal, "failures", updated.LinkCheckFailures)
		}
	}
	return nil
}
