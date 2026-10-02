package bashapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
)

const (
	// workerPoolLimit caps the Worker pool list; the extension shows these in its side panel.
	workerPoolLimit = 100
	// lookupWorkers bounds the parallel catalog lookups behind the list.
	lookupWorkers = 8
	lookupTimeout = 20 * time.Second
	notSpecified  = "Not specified"
)

// workerJob is one Worker pool row for the extension's side panel. The résumé
// fields are present and empty: Bash does not generate or recommend résumés.
type workerJob struct {
	ID                      string  `json:"id"`
	Title                   string  `json:"title"`
	Company                 string  `json:"company"`
	CompanyLogoURL          string  `json:"companyLogoUrl"`
	Location                string  `json:"location"`
	WorkMode                string  `json:"workMode"`
	ApplyURL                string  `json:"applyUrl"`
	JobDescription          string  `json:"jobDescription"`
	HasJobDescription       bool    `json:"hasJobDescription"`
	WorkerPoolAt            *string `json:"workerPoolAt"`
	GeneratedResume         bool    `json:"generatedResume"`
	RecommendedResumeStack  *string `json:"recommendedResumeStack"`
	RecommendedResumeID     *string `json:"recommendedResumeId"`
	RecommendedResumeReason *string `json:"recommendedResumeReason"`
	RecommendWarning        *string `json:"recommendWarning"`
	RecommendedAt           *string `json:"recommendedAt"`
}

// workerPoolIDs are the jobs the job hunter saved and has not applied to yet.
func (s *Server) workerPoolIDs(ctx context.Context, userID string) ([]string, error) {
	saved, err := s.people.SavedJobIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	applied, err := s.people.AppliedJobIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(saved))
	for _, id := range saved {
		if !slices.Contains(applied, id) {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (s *Server) workerJob(ctx context.Context, id string) (workerJob, error) {
	job, err := s.listings.GetCatalogJob(ctx, id, time.Now())
	if err != nil {
		return workerJob{}, err
	}
	description := strings.TrimSpace(job.Description)
	return workerJob{
		ID:                job.ID,
		Title:             orDefault(job.Title, "Untitled role"),
		Company:           orDefault(job.Company, "Unknown company"),
		CompanyLogoURL:    httpURL(job.CompanyLogo),
		Location:          orDefault(job.Location, notSpecified),
		WorkMode:          workMode(job.Workplace),
		ApplyURL:          httpURL(job.ApplyLink),
		JobDescription:    description,
		HasJobDescription: description != "",
	}, nil
}

func (s *Server) listJobs(w http.ResponseWriter, r *http.Request) {
	session, ok := s.session(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), lookupTimeout)
	defer cancel()
	ids, err := s.workerPoolIDs(ctx, session.User.ID)
	if err != nil {
		slog.Error("bash worker pool", "user", session.User.ID, "error", err)
		writeError(w, http.StatusInternalServerError, "could not load jobs")
		return
	}
	if len(ids) > workerPoolLimit {
		ids = ids[:workerPoolLimit]
	}

	rows := make([]*workerJob, len(ids))
	var wg sync.WaitGroup
	slots := make(chan struct{}, lookupWorkers)
	for i, id := range ids {
		wg.Add(1)
		slots <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-slots }()
			row, err := s.workerJob(ctx, id)
			if err != nil {
				if !errors.Is(err, jobs.ErrNotFound) {
					slog.Warn("bash worker pool job", "job", id, "error", err)
				}
				return
			}
			rows[i] = &row
		}()
	}
	wg.Wait()

	list := make([]workerJob, 0, len(rows))
	for _, row := range rows {
		if row != nil {
			list = append(list, *row)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "jobs": list, "total": len(list)})
}

func (s *Server) getJob(w http.ResponseWriter, r *http.Request) {
	session, ok := s.session(w, r)
	if !ok {
		return
	}
	id := r.PathValue("jobId")
	ids, err := s.workerPoolIDs(r.Context(), session.User.ID)
	if err != nil {
		slog.Error("bash worker pool", "user", session.User.ID, "error", err)
		writeError(w, http.StatusInternalServerError, "could not load the job")
		return
	}
	if !slices.Contains(ids, id) {
		writeError(w, http.StatusNotFound, "Worker-pool job not found")
		return
	}
	row, err := s.workerJob(r.Context(), id)
	if errors.Is(err, jobs.ErrNotFound) {
		writeError(w, http.StatusNotFound, "Worker-pool job not found")
		return
	}
	if err != nil {
		slog.Error("bash worker pool job", "job", id, "error", err)
		writeError(w, http.StatusInternalServerError, "could not load the job")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "job": row})
}

// markApplied moves a saved job onto the application board, the same apply as Joined's.
func (s *Server) markApplied(w http.ResponseWriter, r *http.Request) {
	session, ok := s.session(w, r)
	if !ok {
		return
	}
	input := candidate.ApplyInput{JobID: r.PathValue("jobId"), Stage: candidate.StageApplied}
	_, err := s.people.Apply(r.Context(), session.User.ID, input, time.Now())
	switch {
	case err == nil, errors.Is(err, candidate.ErrAlreadyApplied):
		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	case errors.Is(err, candidate.ErrNotFound):
		writeError(w, http.StatusNotFound, "job not found")
	case errors.Is(err, candidate.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		slog.Error("bash mark applied", "job", input.JobID, "error", err)
		writeError(w, http.StatusInternalServerError, "could not mark the job applied")
	}
}

func orDefault(value, fallback string) string {
	if value = strings.TrimSpace(value); value != "" {
		return value
	}
	return fallback
}

func httpURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "//") {
		raw = "https:" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return ""
	}
	return parsed.String()
}

func workMode(value string) string {
	displayed := strings.TrimSpace(value)
	lower := strings.ToLower(displayed)
	switch {
	case strings.Contains(lower, "remote"):
		return "Remote"
	case strings.Contains(lower, "hybrid"):
		return "Hybrid"
	case strings.Contains(lower, "on-site"), strings.Contains(lower, "onsite"), strings.Contains(lower, "office"):
		return "On-site"
	}
	return orDefault(displayed, notSpecified)
}
