package jobs

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

type memoryExpiry struct {
	mu   sync.Mutex
	jobs []expiryJob
}

func (m *memoryExpiry) ListDueExpiryJobs(_ context.Context, now time.Time, cfg ExpiryConfig) ([]expiryJob, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg = cfg.withDefaults()
	out := make([]expiryJob, 0, len(m.jobs))
	for _, job := range m.jobs {
		if !ListingPublic(job.ListingStatus) || strings.TrimSpace(job.ApplyLink) == "" {
			continue
		}
		if !checkDue(job.LastLinkCheckedAt, job.JobSource, job.ListingSource, now, cfg) {
			continue
		}
		out = append(out, job)
		if len(out) >= cfg.Batch {
			break
		}
	}
	return out, nil
}

func (m *memoryExpiry) SaveExpiryCheck(_ context.Context, job expiryJob) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, existing := range m.jobs {
		if existing.ID == job.ID {
			m.jobs[i] = job
			return nil
		}
	}
	m.jobs = append(m.jobs, job)
	return nil
}

func (m *memoryExpiry) byID(id string) expiryJob {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, job := range m.jobs {
		if job.ID == id {
			return job
		}
	}
	return expiryJob{}
}

func alwaysStatus(status int, body string) http.RoundTripper {
	return roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: status,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     http.Header{"Content-Type": []string{"text/html"}},
			Request:    req,
		}, nil
	})
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestExpiryRunnerOffByDefaultDoesNothing(t *testing.T) {
	store := &memoryExpiry{jobs: []expiryJob{{
		ID:            "job-1",
		ApplyLink:     "https://jobs.example.com/apply/1",
		ListingStatus: ListingActive,
		JobSource:     aggregatedSource,
	}}}
	cfg := DefaultExpiryConfig()
	if cfg.Enabled {
		t.Fatal("default config must leave the runner off")
	}
	runner := newExpiryRunner(store, NewLinkChecker(cfg).WithTransport(alwaysStatus(http.StatusNotFound, "")), cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	runner.Run(ctx)
	if store.byID("job-1").LinkCheckFailures != 0 {
		t.Fatal("disabled runner must not probe jobs")
	}
}

func TestExpiryRunnerMarksExpiredAfterConsecutiveFailures(t *testing.T) {
	store := &memoryExpiry{jobs: []expiryJob{
		{
			ID:            "dead",
			ApplyLink:     "https://jobs.example.com/apply/dead",
			ListingStatus: ListingActive,
			JobSource:     aggregatedSource,
			ListingSource: "Greenhouse",
		},
		{
			ID:            "live",
			ApplyLink:     "https://jobs.example.com/apply/live",
			ListingStatus: ListingActive,
			JobSource:     aggregatedSource,
			ListingSource: "Greenhouse",
		},
	}}
	transport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		status := http.StatusOK
		body := "<html>Apply</html>"
		if strings.Contains(req.URL.Path, "/dead") {
			status = http.StatusNotFound
			body = ""
		}
		return &http.Response{
			StatusCode: status,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     http.Header{"Content-Type": []string{"text/html"}},
			Request:    req,
		}, nil
	})
	cfg := DefaultExpiryConfig()
	cfg.Enabled = true
	cfg.FailureThreshold = 3
	cfg.HostInterval = 0
	cfg.Timeout = time.Second
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	runner := newExpiryRunner(store, NewLinkChecker(cfg).WithTransport(transport), cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	runner.now = func() time.Time { return now }

	for i := 0; i < 2; i++ {
		if err := runner.RunOnce(context.Background()); err != nil {
			t.Fatal(err)
		}
		now = now.Add(25 * time.Hour)
		if got := store.byID("dead"); got.ListingStatus == ListingExpired {
			t.Fatalf("expired on failure %d: %+v", i+1, got)
		}
	}
	if err := runner.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	dead := store.byID("dead")
	if dead.ListingStatus != ListingExpired || dead.LinkCheckFailures != 3 {
		t.Fatalf("dead = %+v", dead)
	}
	live := store.byID("live")
	if live.ListingStatus != ListingActive || live.LinkCheckFailures != 0 {
		t.Fatalf("live = %+v", live)
	}
	if listingMatchesSearch(dead.ListingStatus, dead.JobSource, dead.ListingSource, SearchQuery{}) {
		t.Fatal("expired job still matches search")
	}
}

func TestExpiryRunnerOneTransientFailureDoesNotExpire(t *testing.T) {
	store := &memoryExpiry{jobs: []expiryJob{{
		ID:            "flaky",
		ApplyLink:     "https://jobs.example.com/apply/flaky",
		ListingStatus: ListingActive,
		JobSource:     scoutedJobType,
		ListingSource: ScoutedSource,
	}}}
	var calls int
	transport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		calls++
		status := http.StatusOK
		body := "<html>Apply</html>"
		if calls <= 2 {
			status = http.StatusBadGateway
			body = ""
		}
		return &http.Response{
			StatusCode: status,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     http.Header{"Content-Type": []string{"text/html"}},
			Request:    req,
		}, nil
	})
	cfg := DefaultExpiryConfig()
	cfg.FailureThreshold = 3
	cfg.HostInterval = 0
	cfg.Timeout = time.Second
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	runner := newExpiryRunner(store, NewLinkChecker(cfg).WithTransport(transport), cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	runner.now = func() time.Time { return now }

	if err := runner.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	job := store.byID("flaky")
	if job.ListingStatus == ListingExpired || job.LinkCheckFailures != 1 {
		t.Fatalf("after transient = %+v", job)
	}
	now = now.Add(25 * time.Hour)
	if err := runner.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	job = store.byID("flaky")
	if job.LinkCheckFailures != 0 || job.ListingStatus == ListingExpired {
		t.Fatalf("recovery should reset: %+v", job)
	}
}
