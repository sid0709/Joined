// Package migration runs the long copies and AI passes that move AthensDB into JoinedDB
// in the background, one at a time per area, and reports their progress.
package migration

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"
)

// Task is one migration step.
type Task string

const (
	CopyJobs          Task = "jobs-copy"
	AnalyzeJobs       Task = "jobs-analyze"
	CopyCompanies     Task = "companies-copy"
	ResearchCompanies Task = "companies-research"
)

// Tasks lists every step, in the order the console shows them.
var Tasks = []Task{CopyJobs, AnalyzeJobs, CopyCompanies, ResearchCompanies}

// area groups steps that must not overlap: a copy replaces what an AI pass reads.
// Jobs and companies run side by side.
func (t Task) area() string {
	switch t {
	case CopyJobs, AnalyzeJobs:
		return "jobs"
	default:
		return "companies"
	}
}

type Status string

const (
	Running   Status = "running"
	Succeeded Status = "succeeded"
	Failed    Status = "failed"
	Canceled  Status = "canceled"
)

// maxFailures is how many item failures a run keeps to show, newest last.
const maxFailures = 50

var (
	ErrBusy       = errors.New("another migration step for this area is running")
	ErrNotRunning = errors.New("this migration step is not running")
)

// Failure is one item a run could not finish.
type Failure struct {
	ID    string `json:"id"`
	Error string `json:"error"`
}

// Run is a snapshot of one step's latest run.
type Run struct {
	Task       Task       `json:"task"`
	Status     Status     `json:"status"`
	Model      string     `json:"model,omitempty"`
	Total      int64      `json:"total"`
	Done       int64      `json:"done"`
	Skipped    int64      `json:"skipped"`
	Failed     int64      `json:"failed"`
	StartedAt  time.Time  `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt,omitempty"`
	Summary    string     `json:"summary,omitempty"`
	Error      string     `json:"error,omitempty"`
	Failures   []Failure  `json:"failures"`
}

// Work does a step, reporting to progress, and returns a line describing the result.
type Work func(ctx context.Context, progress *Tracker) (string, error)

// Runner holds the latest run of each step. Runs live in memory: after a restart,
// running a step again carries on, since every step is safe to repeat.
type Runner struct {
	mu   sync.Mutex
	runs map[Task]*Tracker
}

func NewRunner() *Runner {
	return &Runner{runs: map[Task]*Tracker{}}
}

// Start begins task in the background unless a step in its area is running.
func (r *Runner) Start(task Task, model string, work Work) (Run, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for other, tracker := range r.runs {
		if other.area() == task.area() && tracker.running() {
			return Run{}, ErrBusy
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	tracker := &Tracker{task: task, model: model, started: time.Now().UTC(), cancel: cancel}
	r.runs[task] = tracker
	go tracker.run(ctx, work)
	return tracker.Snapshot(), nil
}

// Cancel stops task's run. Items already finished stay finished.
func (r *Runner) Cancel(task Task) (Run, error) {
	r.mu.Lock()
	tracker := r.runs[task]
	r.mu.Unlock()
	if tracker == nil || !tracker.running() {
		return Run{}, ErrNotRunning
	}
	tracker.cancel()
	return tracker.Snapshot(), nil
}

// Runs is the latest run of every step that has run since the server started.
func (r *Runner) Runs() map[Task]Run {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make(map[Task]Run, len(r.runs))
	for task, tracker := range r.runs {
		out[task] = tracker.Snapshot()
	}
	return out
}

// Tracker counts one run's progress. It is a jobs.Progress, safe from many goroutines.
type Tracker struct {
	task    Task
	model   string
	started time.Time
	cancel  context.CancelFunc

	total, done, skipped, failed atomic.Int64

	mu       sync.Mutex
	status   Status
	finished *time.Time
	summary  string
	err      string
	failures []Failure
}

func (t *Tracker) Total(n int64) { t.total.Store(n) }
func (t *Tracker) Done(n int64)  { t.done.Add(n) }
func (t *Tracker) Skip(n int64)  { t.skipped.Add(n) }

func (t *Tracker) Fail(id string, err error) {
	t.failed.Add(1)
	t.mu.Lock()
	defer t.mu.Unlock()
	t.failures = append(t.failures, Failure{ID: id, Error: err.Error()})
	if len(t.failures) > maxFailures {
		t.failures = t.failures[len(t.failures)-maxFailures:]
	}
}

func (t *Tracker) running() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.status == "" || t.status == Running
}

func (t *Tracker) run(ctx context.Context, work Work) {
	defer t.cancel()
	t.mu.Lock()
	t.status = Running
	t.mu.Unlock()

	summary, err := work(ctx, t)
	status := Succeeded
	switch {
	case err != nil && ctx.Err() != nil:
		status = Canceled
	case err != nil:
		status = Failed
		slog.Error("migration step failed", "task", t.task, "error", err)
	}
	finished := time.Now().UTC()
	t.mu.Lock()
	defer t.mu.Unlock()
	t.status, t.finished, t.summary = status, &finished, summary
	if status == Failed {
		t.err = err.Error()
	}
}

func (t *Tracker) Snapshot() Run {
	t.mu.Lock()
	defer t.mu.Unlock()
	status := t.status
	if status == "" {
		status = Running
	}
	return Run{
		Task:       t.task,
		Status:     status,
		Model:      t.model,
		Total:      t.total.Load(),
		Done:       t.done.Load(),
		Skipped:    t.skipped.Load(),
		Failed:     t.failed.Load(),
		StartedAt:  t.started,
		FinishedAt: t.finished,
		Summary:    t.summary,
		Error:      t.err,
		Failures:   append([]Failure{}, t.failures...),
	}
}
