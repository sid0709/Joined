package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/sid0709/OpenSeat/admin-backend/internal/migration"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const (
	// maxMigrationSelection caps how many temp jobs one request may pick by hand.
	maxMigrationSelection = 1000
	maxMigrationBody      = 64 << 10
	// missingMigrationKey tells staff how to turn on the migration's AI steps.
	missingMigrationKey = "Set DEEPSEEK_API_KEY in the admin API environment"
)

// MigrationModel reads job posts and researches companies on the web. DeepSeek is it.
type MigrationModel interface {
	jobs.ModelReader
	jobs.WebResearcher
	Ready() bool
}

// MigrationOptions are the migration's model and how many items its AI steps run at once.
type MigrationOptions struct {
	Model           MigrationModel
	AnalyzeWorkers  int
	ResearchWorkers int
}

type migrationStatus struct {
	Counts     *jobs.MigrationCounts            `json:"counts"`
	Model      string                           `json:"model"`
	ModelReady bool                             `json:"modelReady"`
	Runs       map[migration.Task]migration.Run `json:"runs"`
}

// migrationStartRequest picks what an AI step works on. Every field is optional.
type migrationStartRequest struct {
	// TempJobIDs analyzes just these temp jobs.
	TempJobIDs []string `json:"tempJobIds"`
	// Redo works through items an earlier run already finished.
	Redo bool `json:"redo"`
}

func (s *Server) registerMigration(api *http.ServeMux) {
	api.HandleFunc("GET /v1/migration", s.migrationStatus)
	api.HandleFunc("POST /v1/migration/{task}", s.startMigration)
	api.HandleFunc("POST /v1/migration/{task}/cancel", s.cancelMigration)
}

func (s *Server) migrationStatus(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	status := migrationStatus{Runs: s.migration.Runs()}
	if s.ai != nil {
		status.Model, status.ModelReady = s.ai.Model(), s.ai.Ready()
	}
	// Counts are context; the runs still show when a database cannot be counted.
	if counts, err := s.store.MigrationCounts(ctx); err != nil {
		slog.Error("count migration", "error", err)
	} else {
		status.Counts = &counts
	}
	httpkit.WriteJSON(w, http.StatusOK, status)
}

func (s *Server) startMigration(w http.ResponseWriter, r *http.Request) {
	var body migrationStartRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxMigrationBody))
	if err := decoder.Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid migration request")
		return
	}
	if len(body.TempJobIDs) > maxMigrationSelection {
		httpkit.WriteError(w, http.StatusBadRequest, fmt.Sprintf("select at most %d temp jobs", maxMigrationSelection))
		return
	}

	task := migration.Task(r.PathValue("task"))
	work, usesModel, ok := s.migrationWork(task, body)
	if !ok {
		httpkit.WriteError(w, http.StatusNotFound, "unknown migration step")
		return
	}
	model := ""
	if usesModel {
		if s.ai == nil || !s.ai.Ready() {
			httpkit.WriteError(w, http.StatusServiceUnavailable, missingMigrationKey)
			return
		}
		model = s.ai.Model()
	}
	run, err := s.migration.Start(task, model, work)
	if errors.Is(err, migration.ErrBusy) {
		httpkit.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		slog.Error("start migration", "task", task, "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not start the migration step")
		return
	}
	httpkit.WriteJSON(w, http.StatusAccepted, run)
}

func (s *Server) cancelMigration(w http.ResponseWriter, r *http.Request) {
	run, err := s.migration.Cancel(migration.Task(r.PathValue("task")))
	if errors.Is(err, migration.ErrNotRunning) {
		httpkit.WriteError(w, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		httpkit.WriteError(w, http.StatusInternalServerError, "could not stop the migration step")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, run)
}

// migrationWork is the step for task and whether it runs the model.
func (s *Server) migrationWork(task migration.Task, body migrationStartRequest) (migration.Work, bool, bool) {
	switch task {
	case migration.CopyJobs:
		return func(ctx context.Context, progress *migration.Tracker) (string, error) {
			result, err := s.store.Copy(ctx, progress)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("Copied %d jobs from %s into %s.", result.Copied, result.Source, result.Destination), nil
		}, false, true
	case migration.CopyCompanies:
		return func(ctx context.Context, progress *migration.Tracker) (string, error) {
			result, err := s.store.CopyCompanies(ctx, progress)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("Copied %d companies from %s into %s and linked %d jobs.", result.Copied, result.Source, result.Dest, result.Linked), nil
		}, false, true
	case migration.AnalyzeJobs:
		scope := jobs.AnalyzeScope{IDs: body.TempJobIDs, Redo: body.Redo}
		return func(ctx context.Context, progress *migration.Tracker) (string, error) {
			err := s.store.AnalyzeTempJobs(ctx, s.ai, scope, s.analyzeWorkers, progress)
			return tally("Analyzed", progress.Snapshot()), err
		}, true, true
	case migration.ResearchCompanies:
		return func(ctx context.Context, progress *migration.Tracker) (string, error) {
			err := s.store.ResearchCompanies(ctx, s.ai, s.ai.Model(), body.Redo, s.researchWorkers, progress)
			return tally("Researched", progress.Snapshot()), err
		}, true, true
	}
	return nil, false, false
}

func tally(verb string, run migration.Run) string {
	return fmt.Sprintf("%s %d of %d. %d skipped, %d failed.", verb, run.Done, run.Total, run.Skipped, run.Failed)
}
