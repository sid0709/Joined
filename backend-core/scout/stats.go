package scout

import (
	"context"
	"time"

	"golang.org/x/sync/errgroup"
)

// Meta is the public rulebook: levels, promotion, rewards, and input limits.
// Clients render it instead of hardcoding any of these numbers.
type Meta struct {
	Levels    []LevelRule   `json:"levels"`
	Promotion PromotionRule `json:"promotion"`
	Rewards   RewardTable   `json:"rewards"`
	Limits    Limits        `json:"limits"`
	Reasons   []Reason      `json:"rejection_reasons"`
}

// Rulebook returns the scout rules with the default config.
func Rulebook() Meta {
	return RulebookWithConfig(DefaultConfig())
}

// RulebookWithConfig returns the scout rules with the given config.
func RulebookWithConfig(cfg Config) Meta {
	return Meta{
		Levels:    Levels(),
		Promotion: Promotion(),
		Rewards:   Rewards(cfg),
		Limits:    InputLimits(),
		Reasons:   RejectReasons(),
	}
}

// Rulebook returns the scout rules with this store's config.
func (s *Store) Rulebook() Meta {
	return RulebookWithConfig(s.config)
}

// Stats is a scout's dashboard: level, quality, money, and today's allowance.
type Stats struct {
	Profile   Profile         `json:"profile"`
	Level     LevelRule       `json:"level"`
	NextLevel *LevelRule      `json:"next_level"`
	Promotion PromotionRule   `json:"promotion"`
	Metrics   Metrics         `json:"metrics"`
	Balance   Balance         `json:"balance"`
	Payout    PayoutReadiness `json:"payout"`
	Quota     Quota           `json:"quota"`
	Unread    int64           `json:"unread_notifications"`
	// Activity is candidate usage summed over the scout's live jobs.
	Activity JobActivity `json:"activity"`
}

// Stats gathers everything the scout dashboard shows. The reads after the
// profile are independent, so they run at once.
func (s *Store) Stats(ctx context.Context, userID string) (Stats, error) {
	profile, err := s.EnsureProfile(ctx, userID)
	if err != nil {
		return Stats{}, err
	}
	stats := Stats{
		Profile:   profile,
		Level:     Rule(profile.Level),
		Promotion: Promotion(),
	}
	group, gctx := errgroup.WithContext(ctx)
	group.Go(func() error {
		rows, err := s.metricRows(gctx, userID)
		if err != nil {
			return err
		}
		stats.Metrics = ComputeMetrics(profile.Level, rows, s.now())
		stats.Activity, err = s.liveActivity(gctx, rows)
		return err
	})
	group.Go(func() (err error) {
		stats.Balance, err = s.Balance(gctx, userID)
		return err
	})
	group.Go(func() (err error) {
		stats.Unread, err = s.UnreadCount(gctx, userID)
		return err
	})
	if err := group.Wait(); err != nil {
		return Stats{}, err
	}
	resets, _ := time.Parse(time.RFC3339, stats.Metrics.ResetsAt)
	stats.Quota = Quota{Limit: stats.Metrics.DailyLimit, Remaining: stats.Metrics.RemainingToday, ResetsAt: resets}
	paid, err := s.hasPaidPayout(ctx, userID)
	if err != nil {
		return Stats{}, err
	}
	stats.Payout = CheckPayout(profile, stats.Balance.Released.AmountCents, paid)
	if next := NextLevel(profile.Level); next != "" {
		rule := Rule(next)
		stats.NextLevel = &rule
	}
	return stats, nil
}

// liveActivity sums applications and interviews over the scout's live jobs.
func (s *Store) liveActivity(ctx context.Context, rows []metricRow) (JobActivity, error) {
	ids := []string{}
	for _, row := range rows {
		if row.Status == StatusApproved && !row.Expired && row.JobID != "" {
			ids = append(ids, row.JobID)
		}
	}
	if s.usage == nil || len(ids) == 0 {
		return JobActivity{}, nil
	}
	usage, err := s.usage.UsageByJob(ctx, ids)
	if err != nil {
		return JobActivity{}, err
	}
	var total JobActivity
	for _, u := range usage {
		total.Applications += u.Applications
		total.Interviews += u.Interviews
	}
	return total, nil
}
