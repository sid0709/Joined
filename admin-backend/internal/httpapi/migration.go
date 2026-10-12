package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/sid0709/Joined/admin-backend/internal/migration"
	"github.com/sid0709/Joined/backend-core/deepseek"
	"github.com/sid0709/Joined/backend-core/httpkit"
	"github.com/sid0709/Joined/backend-core/jobs"
	"github.com/sid0709/Joined/backend-core/metrics"
)

const (
	// maxMigrationSelection caps how many temp jobs one request may pick by hand.
	maxMigrationSelection = 1000
	maxMigrationBody      = 64 << 10
	// missingMigrationKey tells staff how to turn on the migration's AI steps.
	missingMigrationKey = "Save an OpenRouter API key under Settings → AI Model, or set OPENROUTER_API_KEY"
)

// MigrationModel reads job posts and researches companies on the web. OpenRouter is it.
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
	// CompanyIDs researches just these staged companies.
	CompanyIDs []string `json:"companyIds"`
	// Redo works through items an earlier run already finished.
	Redo bool `json:"redo"`
	// WebSearch is whether the model may use web_search. Nil keeps it on.
	// The Decisions approach ignores it.
	WebSearch *bool `json:"webSearch"`
	// Approach is chat, batch, or decisions. Empty follows the model id.
	Approach string `json:"approach"`
	// Model overrides the saved default for this run.
	Model string `json:"model"`
}

func (r migrationStartRequest) useWebSearch() bool {
	if r.WebSearch == nil {
		return true
	}
	return *r.WebSearch
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
	if selected := max(len(body.TempJobIDs), len(body.CompanyIDs)); selected > maxMigrationSelection {
		httpkit.WriteError(w, http.StatusBadRequest, fmt.Sprintf("select at most %d at a time", maxMigrationSelection))
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
		model = strings.TrimSpace(body.Model)
		if model == "" {
			model = s.ai.Model()
		}
		if len(model) > maxModelID || strings.ContainsAny(model, " \t\r\n") {
			httpkit.WriteError(w, http.StatusBadRequest, invalidModelName)
			return
		}
		approach := body.Approach
		if approach == "" {
			approach = deepseek.ApproachFor(model)
		}
		if err := deepseek.CheckApproach(approach, model); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		body.Approach = approach
		body.Model = model
		work, _, _ = s.migrationWork(task, body)
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
	case migration.AnalyzeJobs:
		scope := jobs.AnalyzeScope{IDs: body.TempJobIDs, Redo: body.Redo, WebSearch: body.useWebSearch(), Approach: body.Approach}
		return func(ctx context.Context, progress *migration.Tracker) (string, error) {
			ctx = metrics.WithFeature(ctx, metrics.FeatureMigration)
			err := s.store.AnalyzeTempJobs(ctx, s.migrationReader(body.Model), scope, s.analyzeWorkers, progress)
			return tally("Published", "not publishable", progress.Snapshot()), err
		}, true, true
	case migration.ResearchCompanies:
		return func(ctx context.Context, progress *migration.Tracker) (string, error) {
			ctx = metrics.WithFeature(ctx, metrics.FeatureMigration)
			reader := s.migrationReader(body.Model)
			err := s.store.ResearchCompanies(ctx, reader, reader.Model(), jobs.ResearchScope{IDs: body.CompanyIDs, Redo: body.Redo, WebSearch: body.useWebSearch(), Approach: body.Approach}, s.researchWorkers, progress)
			return tally("Published", "not found", progress.Snapshot()), err
		}, true, true
	}
	return nil, false, false
}

// migrationReader is the saved model, or that client pinned to model for this run.
func (s *Server) migrationReader(model string) MigrationModel {
	if model == "" || s.ai == nil {
		return s.ai
	}
	if live, ok := s.ai.(*deepseek.Reloading); ok {
		return live.WithModel(model)
	}
	return s.ai
}

// tally says how a run went: "Published 90 of 100. 8 not found, 2 failed."
func tally(verb, skipped string, run migration.Run) string {
	return fmt.Sprintf("%s %d of %d. %d %s, %d failed.", verb, run.Done, run.Total, run.Skipped, skipped, run.Failed)
}
