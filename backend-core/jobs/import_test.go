package jobs

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

func sampleImport(id string) ImportRecord {
	return ImportRecord{
		ExternalID:  id,
		Company:     "Acme",
		Title:       "Software Engineer",
		Location:    "New York, NY",
		ApplyURL:    "https://jobs.acme.example/" + id,
		Source:      aggregatedSource,
		PostedAt:    time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		Description: "Build the import runner.",
	}
}

func testRunner(t *testing.T, source *FakeSource, opts RunnerOptions) (*Runner, *MemorySink, *MemoryRunLog) {
	t.Helper()
	registry := NewSourceRegistry()
	if source != nil {
		registry.Register(source)
	}
	sink := &MemorySink{}
	log := NewMemoryRunLog()
	if opts.Registry == nil {
		opts.Registry = registry
	}
	if opts.Sink == nil {
		opts.Sink = sink
	}
	if opts.Log == nil {
		opts.Log = log
	}
	if opts.Lock == nil {
		opts.Lock = &MemoryLock{}
	}
	if opts.Pool == nil {
		opts.Pool = &memoryDedupePool{}
	}
	return NewRunner(opts), sink, log
}

func TestImportRunnerDisabledSkipsFetch(t *testing.T) {
	source := &FakeSource{Name: FakeSourceID, On: true, Records: []ImportRecord{sampleImport("1")}}
	runner, sink, log := testRunner(t, source, RunnerOptions{})
	run, err := runner.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != ImportRunDisabled {
		t.Fatalf("status = %q", run.Status)
	}
	if source.FetchCount() != 0 {
		t.Fatalf("fetches = %d", source.FetchCount())
	}
	if sink.Count() != 0 {
		t.Fatalf("staged = %d", sink.Count())
	}
	recent, err := log.Recent(context.Background(), 5)
	if err != nil || len(recent) != 1 || recent[0].Status != ImportRunDisabled {
		t.Fatalf("recent = %#v err=%v", recent, err)
	}
}

func TestImportRunnerDisabledSourceDoesNotFetch(t *testing.T) {
	source := &FakeSource{Name: FakeSourceID, On: false, Records: []ImportRecord{sampleImport("1")}}
	runner, sink, _ := testRunner(t, source, RunnerOptions{Enabled: true})
	run, err := runner.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != ImportRunOK {
		t.Fatalf("status = %q", run.Status)
	}
	if source.FetchCount() != 0 {
		t.Fatalf("fetches = %d", source.FetchCount())
	}
	if len(run.Sources) != 1 || run.Sources[0].Reason != importSourceDisabledReason {
		t.Fatalf("sources = %#v", run.Sources)
	}
	if sink.Count() != 0 {
		t.Fatalf("staged = %d", sink.Count())
	}
}

func TestFakeSourceNormalizesAndDedupes(t *testing.T) {
	first := sampleImport("a")
	dup := first
	dup.ExternalID = "a-dup"
	dup.Title = "  Software   Engineer "
	dup.Company = "ACME"
	dup.ApplyURL = first.ApplyURL + "?utm_source=board"
	other := sampleImport("b")
	other.Title = "Staff Engineer"
	other.ApplyURL = "https://jobs.acme.example/staff"
	invalid := ImportRecord{ExternalID: "bad", Title: " ", Company: "Acme"}

	source := &FakeSource{Name: FakeSourceID, On: true, Records: []ImportRecord{first, dup, other, invalid}}
	runner, sink, _ := testRunner(t, source, RunnerOptions{Enabled: true})
	run, err := runner.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != ImportRunPartial {
		t.Fatalf("status = %q", run.Status)
	}
	if run.Totals.Fetched != 4 || run.Totals.Inserted != 2 || run.Totals.Skipped != 1 || run.Totals.Failed != 1 {
		t.Fatalf("totals = %+v", run.Totals)
	}
	if sink.Count() != 2 {
		t.Fatalf("staged = %d", sink.Count())
	}
}

func TestFakeSourceSkipsExistingCatalogJob(t *testing.T) {
	incoming := sampleImport("new")
	existing := incoming.DedupeRecord()
	existing.ID = "catalog-1"
	existing.JobID = "catalog-1"
	pool := &memoryDedupePool{records: []DedupeRecord{existing}}
	source := &FakeSource{Name: FakeSourceID, On: true, Records: []ImportRecord{incoming}}
	runner, sink, _ := testRunner(t, source, RunnerOptions{Enabled: true, Pool: pool})
	run, err := runner.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if run.Totals.Skipped != 1 || run.Totals.Inserted != 0 {
		t.Fatalf("totals = %+v", run.Totals)
	}
	if sink.Count() != 0 {
		t.Fatal("duplicate must not be staged")
	}
}

func TestImportLockBlocksSecondRun(t *testing.T) {
	source := &FakeSource{Name: FakeSourceID, On: true, Records: []ImportRecord{sampleImport("1")}}
	lock := &MemoryLock{}
	held, ok, err := lock.TryLock(context.Background())
	if err != nil || !ok {
		t.Fatalf("pre-lock: ok=%v err=%v", ok, err)
	}
	defer held()
	runner, _, _ := testRunner(t, source, RunnerOptions{Enabled: true, Lock: lock})
	run, err := runner.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != ImportRunLocked {
		t.Fatalf("status = %q", run.Status)
	}
	if source.FetchCount() != 0 {
		t.Fatalf("fetches = %d", source.FetchCount())
	}
}

func TestImportKillSwitchSkipsSource(t *testing.T) {
	source := &FakeSource{Name: FakeSourceID, On: true, Records: []ImportRecord{sampleImport("1")}}
	gate := allowAdapter{fn: func(id string) bool { return id != FakeSourceID }}
	runner, sink, _ := testRunner(t, source, RunnerOptions{Enabled: true, Gate: gate})
	run, err := runner.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != ImportRunKilled {
		t.Fatalf("status = %q", run.Status)
	}
	if source.FetchCount() != 0 || sink.Count() != 0 {
		t.Fatalf("fetches=%d staged=%d", source.FetchCount(), sink.Count())
	}
	if run.Sources[0].Reason != importKilledReason {
		t.Fatalf("reason = %q", run.Sources[0].Reason)
	}
}

func TestLookupImportKillSwitchMissingIsAllowAll(t *testing.T) {
	RegisterImportKillSwitch(nil)
	t.Cleanup(func() { RegisterImportKillSwitch(nil) })
	if LookupImportKillSwitch() != nil {
		t.Fatal("missing step-26 gate should be nil")
	}
	if !effectiveKillSwitch(LookupImportKillSwitch()).Allow(AthensSourceID) {
		t.Fatal("nil gate must allow imports")
	}
}

func TestKillSwitchFromOptionalInterfaces(t *testing.T) {
	if KillSwitchFrom(nil) != nil {
		t.Fatal("nil value should be ignored")
	}
	if KillSwitchFrom(struct{}{}) != nil {
		t.Fatal("unknown type should be ignored")
	}
	gate := KillSwitchFrom(sourceEnabledStub{on: map[string]bool{AthensSourceID: false, FakeSourceID: true}})
	if gate == nil {
		t.Fatal("SourceEnabled adapter missing")
	}
	if gate.Allow(AthensSourceID) {
		t.Fatal("athens should be blocked")
	}
	if !gate.Allow(FakeSourceID) {
		t.Fatal("fake should be allowed")
	}
}

func TestAthensSourceStaysDisabledUntilFlagged(t *testing.T) {
	source := NewAthensSource(&Store{}, false)
	if source.Enabled() || source.ID() != AthensSourceID {
		t.Fatalf("id=%s enabled=%v", source.ID(), source.Enabled())
	}
}

func TestStartReturnsWhenDisabled(t *testing.T) {
	source := &FakeSource{Name: FakeSourceID, On: true, Records: []ImportRecord{sampleImport("1")}}
	runner, _, _ := testRunner(t, source, RunnerOptions{})
	done := make(chan struct{})
	go func() {
		runner.Start(context.Background())
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Start should return when disabled")
	}
	if source.FetchCount() != 0 {
		t.Fatalf("fetches = %d", source.FetchCount())
	}
}

func TestStartStopsOnCancel(t *testing.T) {
	source := &FakeSource{Name: FakeSourceID, On: true, Records: []ImportRecord{sampleImport("1")}}
	runner, _, _ := testRunner(t, source, RunnerOptions{Enabled: true, Interval: time.Hour})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	done := make(chan struct{})
	go func() {
		runner.Start(ctx)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Start should return when the context is already done")
	}
}

func TestConcurrentRunsUseLock(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	source := &blockingSource{FakeSource: FakeSource{Name: FakeSourceID, On: true, Records: []ImportRecord{sampleImport("1")}}, started: started, release: release}
	lock := &MemoryLock{}
	runner, _, log := testRunner(t, nil, RunnerOptions{
		Enabled:  true,
		Registry: NewSourceRegistry(),
		Lock:     lock,
	})
	runner.registry.Register(source)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		if _, err := runner.Run(context.Background()); err != nil {
			t.Error(err)
		}
	}()
	<-started
	second, err := runner.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if second.Status != ImportRunLocked {
		t.Fatalf("second status = %q", second.Status)
	}
	close(release)
	wg.Wait()
	recent, err := log.Recent(context.Background(), 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 2 {
		t.Fatalf("runs = %d", len(recent))
	}
}

func TestFakeSourceFetchErrorMarksRunFailed(t *testing.T) {
	source := &FakeSource{Name: FakeSourceID, On: true, Err: errors.New("feed down")}
	runner, _, _ := testRunner(t, source, RunnerOptions{Enabled: true})
	run, err := runner.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != ImportRunFailed {
		t.Fatalf("status = %q", run.Status)
	}
	if !strings.Contains(run.Sources[0].Error, "feed down") {
		t.Fatalf("error = %q", run.Sources[0].Error)
	}
}

func TestNormalizeImportRecordCanonicalizesApplyURL(t *testing.T) {
	rec := ImportRecord{
		Company:  "  Acme  ",
		Title:    "Engineer",
		ApplyURL: " HTTP://Jobs.Example.com/a?utm_source=x ",
	}.Normalize()
	if rec.Company != "Acme" {
		t.Fatalf("company = %q", rec.Company)
	}
	if rec.ApplyURL != "https://jobs.example.com/a" {
		t.Fatalf("apply url = %q", rec.ApplyURL)
	}
	if rec.ExternalID != rec.ApplyURL {
		t.Fatalf("external id = %q", rec.ExternalID)
	}
}

type sourceEnabledStub struct {
	on map[string]bool
}

func (s sourceEnabledStub) SourceEnabled(id string) bool {
	return s.on[id]
}

type blockingSource struct {
	FakeSource
	started chan struct{}
	release chan struct{}
}

func (s *blockingSource) Fetch(ctx context.Context) ([]ImportRecord, error) {
	close(s.started)
	select {
	case <-s.release:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return s.FakeSource.Fetch(ctx)
}
