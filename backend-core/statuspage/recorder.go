package statuspage

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/sid0709/Joined/backend-core/metrics"
	"github.com/sid0709/Joined/backend-core/monitoring"
)

const (
	// RecordInterval is how often today's uptime is saved.
	RecordInterval = 10 * time.Minute
	// minWindow keeps the day's first query long enough to hold a few probes.
	minWindow = time.Minute
	// subqueryStep is how finely a day is sampled: one probe result a minute.
	subqueryStep = "1m"
)

// currentQuery is each component's probes right now: down if any probe fails.
const currentQuery = `min by (component) (probe_success{component!=""})`

// uptimeQuery is the share of minutes, over the window ending now, in which every
// probe of the component passed. %d is the window in seconds.
const uptimeQuery = `avg_over_time((min by (component) (probe_success{component!=""}))[%ds:` + subqueryStep + `])`

// Recorder saves each day's uptime from Prometheus into the Store, so the page
// keeps 90 days while Prometheus keeps only 30. Several instances may run; each
// write replaces the day's figure with the same answer.
type Recorder struct {
	prom  monitoring.Querier
	store Store
	log   *slog.Logger
}

// NewRecorder records from prom into store.
func NewRecorder(prom monitoring.Querier, store Store, log *slog.Logger) *Recorder {
	return &Recorder{prom: prom, store: store, log: log}
}

// Run records now and then every RecordInterval until ctx ends.
func (r *Recorder) Run(ctx context.Context) {
	ticker := time.NewTicker(RecordInterval)
	defer ticker.Stop()
	for {
		if err := r.Record(ctx, time.Now()); err != nil {
			r.log.Warn("status uptime", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// Record saves today so far and, again, all of yesterday: the first runs after
// midnight close out the day before.
func (r *Recorder) Record(ctx context.Context, now time.Time) (err error) {
	started := time.Now()
	defer func() {
		metrics.ObserveWorker(metrics.WorkerStatus, time.Since(started), err != nil, 0)
	}()
	midnight := startOfDay(now)
	today := max(now.Sub(midnight), minWindow)
	if err = r.recordDay(ctx, dayOf(now), now, today); err != nil {
		return err
	}
	return r.recordDay(ctx, dayOf(midnight.Add(-time.Second)), midnight, 24*time.Hour)
}

func (r *Recorder) recordDay(ctx context.Context, day string, at time.Time, window time.Duration) error {
	seconds := int(window.Seconds())
	uptime := map[string]float64{}
	if err := r.collect(ctx, fmt.Sprintf(uptimeQuery, seconds), at, func(s monitoring.Sample) {
		if id := s.Labels["component"]; KnownComponent(id) {
			uptime[id] = s.Value
		}
	}); err != nil {
		return fmt.Errorf("query uptime for %s: %w", day, err)
	}
	if err := r.collect(ctx, monitoring.HostUptimeQuery(seconds), at, func(s monitoring.Sample) {
		if s.Labels["component"] != "" && s.Labels["component"] != monitoring.HostID {
			return
		}
		if cur, ok := uptime[monitoring.HostID]; !ok || s.Value < cur {
			uptime[monitoring.HostID] = s.Value
		}
	}); err != nil {
		return fmt.Errorf("query host uptime for %s: %w", day, err)
	}
	if err := r.collect(ctx, monitoring.ProbeUptimeQuery(seconds), at, func(s monitoring.Sample) {
		if instance := s.Labels["instance"]; instance != "" {
			uptime[instance] = s.Value
		}
	}); err != nil {
		return fmt.Errorf("query probe uptime for %s: %w", day, err)
	}
	return r.store.RecordUptime(ctx, day, uptime, at)
}

func (r *Recorder) collect(ctx context.Context, query string, at time.Time, keep func(monitoring.Sample)) error {
	if r.prom == nil {
		return nil
	}
	samples, err := r.prom.Query(ctx, query, at)
	if err != nil {
		return err
	}
	for _, sample := range samples {
		keep(sample)
	}
	return nil
}
