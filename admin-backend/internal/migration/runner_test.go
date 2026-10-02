package migration

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

// waitFor polls until the task's run is no longer running.
func waitFor(t *testing.T, r *Runner, task Task) Run {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if run := r.Runs()[task]; run.Status != Running {
			return run
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("%s did not finish", task)
	return Run{}
}

func TestRunnerCountsProgressAndFinishes(t *testing.T) {
	r := NewRunner()
	_, err := r.Start(AnalyzeJobs, "deepseek-flash", func(_ context.Context, p *Tracker) (string, error) {
		p.Total(3)
		p.Done(1)
		p.Skip(1)
		p.Fail("job-3", errors.New("bad json"))
		return "Analyzed 1", nil
	})
	if err != nil {
		t.Fatal(err)
	}
	run := waitFor(t, r, AnalyzeJobs)
	if run.Status != Succeeded || run.Total != 3 || run.Done != 1 || run.Skipped != 1 || run.Failed != 1 {
		t.Fatalf("run = %+v", run)
	}
	if run.Model != "deepseek-flash" || run.Summary != "Analyzed 1" || run.FinishedAt == nil || len(run.Failures) != 1 {
		t.Fatalf("run = %+v", run)
	}
}

func TestRunnerKeepsOneStepPerAreaButRunsAreasTogether(t *testing.T) {
	r := NewRunner()
	release := make(chan struct{})
	block := func(ctx context.Context, _ *Tracker) (string, error) {
		select {
		case <-release:
			return "", nil
		case <-ctx.Done():
			return "", ctx.Err()
		}
	}
	if _, err := r.Start(CopyJobs, "", block); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Start(AnalyzeJobs, "", block); !errors.Is(err, ErrBusy) {
		t.Fatalf("second jobs step: %v", err)
	}
	if _, err := r.Start(CopyCompanies, "", block); err != nil {
		t.Fatalf("companies alongside jobs: %v", err)
	}
	close(release)
	waitFor(t, r, CopyJobs)
	waitFor(t, r, CopyCompanies)
	if _, err := r.Start(AnalyzeJobs, "", func(context.Context, *Tracker) (string, error) { return "", nil }); err != nil {
		t.Fatalf("after the copy: %v", err)
	}
}

func TestRunnerCancelAndFailure(t *testing.T) {
	r := NewRunner()
	if _, err := r.Cancel(ResearchCompanies); !errors.Is(err, ErrNotRunning) {
		t.Fatalf("cancel idle: %v", err)
	}
	_, _ = r.Start(ResearchCompanies, "", func(ctx context.Context, _ *Tracker) (string, error) {
		<-ctx.Done()
		return "", ctx.Err()
	})
	if _, err := r.Cancel(ResearchCompanies); err != nil {
		t.Fatal(err)
	}
	if run := waitFor(t, r, ResearchCompanies); run.Status != Canceled {
		t.Fatalf("status = %s", run.Status)
	}

	_, _ = r.Start(CopyJobs, "", func(context.Context, *Tracker) (string, error) {
		return "", errors.New("count mismatch")
	})
	if run := waitFor(t, r, CopyJobs); run.Status != Failed || run.Error != "count mismatch" {
		t.Fatalf("run = %+v", run)
	}
}

func TestTrackerKeepsTheNewestFailures(t *testing.T) {
	tracker := &Tracker{}
	for i := range maxFailures + 5 {
		tracker.Fail(fmt.Sprint(i), errors.New("x"))
	}
	run := tracker.Snapshot()
	if run.Failed != maxFailures+5 || len(run.Failures) != maxFailures || run.Failures[0].ID != "5" {
		t.Fatalf("failed = %d kept = %d first = %s", run.Failed, len(run.Failures), run.Failures[0].ID)
	}
}
