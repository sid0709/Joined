package jobs

import (
	"context"
	"fmt"
	"time"
)

// Runner applies enabled sources through normalize + dedupe and writes a run log.
type Runner struct {
	enabled  bool
	interval time.Duration
	timeout  time.Duration
	registry *SourceRegistry
	lock     ImportLock
	log      ImportRunLog
	gate     ImportKillSwitch
	sink     ImportSink
	pool     DedupePool
	now      func() time.Time
	newID    func() (string, error)
}

// RunnerOptions are the parts a service wires when it starts the scheduler.
type RunnerOptions struct {
	Enabled  bool
	Interval time.Duration
	Timeout  time.Duration
	Registry *SourceRegistry
	Lock     ImportLock
	Log      ImportRunLog
	Gate     ImportKillSwitch
	Sink     ImportSink
	Pool     DedupePool
}

func NewRunner(opts RunnerOptions) *Runner {
	interval := opts.Interval
	if interval <= 0 {
		interval = defaultImportInterval
	}
	lock := opts.Lock
	if lock == nil {
		lock = &MemoryLock{}
	}
	log := opts.Log
	if log == nil {
		log = NewMemoryRunLog()
	}
	return &Runner{
		enabled:  opts.Enabled,
		interval: interval,
		timeout:  opts.Timeout,
		registry: opts.Registry,
		lock:     lock,
		log:      log,
		gate:     opts.Gate,
		sink:     opts.Sink,
		pool:     opts.Pool,
		now:      time.Now,
		newID:    newPublicID,
	}
}

func (r *Runner) Enabled() bool {
	return r != nil && r.enabled
}

func (r *Runner) Sources() []SourceStatus {
	if r == nil || r.registry == nil {
		return nil
	}
	return r.registry.Status()
}

func (r *Runner) Recent(ctx context.Context, limit int) ([]ImportRun, error) {
	if r == nil || r.log == nil {
		return []ImportRun{}, nil
	}
	return r.log.Recent(ctx, limit)
}

func (r *Runner) Run(ctx context.Context) (ImportRun, error) {
	started := r.clock()
	run := ImportRun{
		ID:        r.runID(),
		StartedAt: started,
		Status:    ImportRunOK,
		Sources:   []SourceStats{},
	}
	if !r.enabled {
		run.Status = ImportRunDisabled
		run.Reason = importDisabledReason
		run.EndedAt = r.clock()
		return run, r.append(ctx, run)
	}

	unlock, acquired, err := r.lock.TryLock(ctx)
	if err != nil {
		run.Status = ImportRunFailed
		run.Reason = err.Error()
		run.EndedAt = r.clock()
		_ = r.append(ctx, run)
		return run, fmt.Errorf("import lock: %w", err)
	}
	if !acquired {
		run.Status = ImportRunLocked
		run.Reason = importLockedReason
		run.EndedAt = r.clock()
		return run, r.append(ctx, run)
	}
	defer unlock()

	runCtx := ctx
	cancel := func() {}
	if r.timeout > 0 {
		runCtx, cancel = context.WithTimeout(ctx, r.timeout)
	}
	defer cancel()

	overlay := &memoryDedupePool{}
	pool := layeredPool{overlay: overlay, base: r.pool}
	gate := effectiveKillSwitch(r.gate)
	if r.registry == nil {
		run.EndedAt = r.clock()
		return run, r.append(ctx, run)
	}

	for _, source := range r.registry.Sources() {
		stats := SourceStats{SourceID: source.ID(), Enabled: source.Enabled()}
		if !source.Enabled() {
			stats.Reason = importSourceDisabledReason
			run.Sources = append(run.Sources, stats)
			continue
		}
		if !gate.Allow(source.ID()) {
			stats.Reason = importKilledReason
			run.Sources = append(run.Sources, stats)
			if run.Status == ImportRunOK {
				run.Status = ImportRunKilled
			}
			continue
		}
		records, fetchErr := source.Fetch(runCtx)
		if fetchErr != nil {
			stats.Error = fetchErr.Error()
			run.Sources = append(run.Sources, stats)
			run.Status = ImportRunFailed
			continue
		}
		stats.Fetched = len(records)
		for _, rec := range records {
			rec = rec.Normalize()
			if rec.Source == "" {
				rec.Source = source.ID()
			}
			if !rec.Valid() {
				stats.Failed++
				continue
			}
			plan, planErr := PlanDedupeWrite(runCtx, DefaultDedupeConfig(), pool, rec.DedupeRecord())
			if planErr != nil {
				stats.Failed++
				continue
			}
			switch plan.Action {
			case dedupeActionSkip:
				stats.Skipped++
			case dedupeActionInsert, dedupeActionReplace:
				if r.sink != nil {
					if stageErr := r.sink.Stage(runCtx, rec); stageErr != nil {
						stats.Failed++
						continue
					}
				}
				if plan.Action == dedupeActionInsert {
					stats.Inserted++
				} else {
					stats.Replaced++
				}
				overlay.remember(plan.Save)
			default:
				stats.Failed++
			}
		}
		run.Sources = append(run.Sources, stats)
	}

	run.Totals = sumImportStats(run.Sources)
	if run.Status == ImportRunOK && run.Totals.Failed > 0 {
		run.Status = ImportRunPartial
	}
	run.EndedAt = r.clock()
	return run, r.append(ctx, run)
}

func (r *Runner) append(ctx context.Context, run ImportRun) error {
	if r.log == nil {
		return nil
	}
	if err := r.log.Append(ctx, run); err != nil {
		return fmt.Errorf("record import run: %w", err)
	}
	return nil
}

func (r *Runner) clock() time.Time {
	if r.now == nil {
		return time.Now().UTC()
	}
	return r.now().UTC()
}

func (r *Runner) runID() string {
	if r.newID != nil {
		if id, err := r.newID(); err == nil && id != "" {
			return id
		}
	}
	return fmt.Sprintf("import-%d", r.clock().UnixNano())
}

func sumImportStats(sources []SourceStats) ImportStats {
	var totals ImportStats
	for _, source := range sources {
		totals.Fetched += source.Fetched
		totals.Inserted += source.Inserted
		totals.Replaced += source.Replaced
		totals.Skipped += source.Skipped
		totals.Failed += source.Failed
	}
	return totals
}

type layeredPool struct {
	overlay *memoryDedupePool
	base    DedupePool
}

func (p layeredPool) FindActiveByKey(ctx context.Context, key, exceptID string) (*DedupeRecord, error) {
	if p.overlay != nil {
		rec, err := p.overlay.FindActiveByKey(ctx, key, exceptID)
		if err != nil || rec != nil {
			return rec, err
		}
	}
	if p.base == nil {
		return nil, nil
	}
	return p.base.FindActiveByKey(ctx, key, exceptID)
}

func (p layeredPool) FindFuzzyCandidates(ctx context.Context, incoming DedupeRecord, exceptID string) ([]DedupeRecord, error) {
	var out []DedupeRecord
	seen := map[string]struct{}{}
	if p.overlay != nil {
		overlay, err := p.overlay.FindFuzzyCandidates(ctx, incoming, exceptID)
		if err != nil {
			return nil, err
		}
		for _, rec := range overlay {
			out = append(out, rec)
			seen[rec.ID+rec.Key()] = struct{}{}
		}
	}
	if p.base == nil {
		return out, nil
	}
	base, err := p.base.FindFuzzyCandidates(ctx, incoming, exceptID)
	if err != nil {
		return nil, err
	}
	for _, rec := range base {
		if _, ok := seen[rec.ID+rec.Key()]; ok {
			continue
		}
		out = append(out, rec)
	}
	return out, nil
}

type memoryDedupePool struct {
	records []DedupeRecord
}

func (m *memoryDedupePool) remember(rec DedupeRecord) {
	if m == nil {
		return
	}
	for i, existing := range m.records {
		if existing.ID != "" && existing.ID == rec.ID {
			m.records[i] = rec
			return
		}
		if existing.Key() == rec.Key() {
			m.records[i] = rec
			return
		}
	}
	m.records = append(m.records, rec)
}

func (m *memoryDedupePool) FindActiveByKey(_ context.Context, key, exceptID string) (*DedupeRecord, error) {
	if m == nil || key == "" {
		return nil, nil
	}
	for _, rec := range m.records {
		if exceptID != "" && rec.ID == exceptID {
			continue
		}
		if !ListingPublic(rec.ListingStatus) {
			continue
		}
		if rec.Key() == key {
			copy := rec
			return &copy, nil
		}
	}
	return nil, nil
}

func (m *memoryDedupePool) FindFuzzyCandidates(_ context.Context, _ DedupeRecord, exceptID string) ([]DedupeRecord, error) {
	if m == nil {
		return nil, nil
	}
	out := make([]DedupeRecord, 0, len(m.records))
	for _, rec := range m.records {
		if exceptID != "" && rec.ID == exceptID {
			continue
		}
		if !ListingPublic(rec.ListingStatus) {
			continue
		}
		out = append(out, rec)
	}
	return out, nil
}
