package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/authapi"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
	"github.com/sid0709/OpenSeat/backend-core/fitscore"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/killswitch"
)

const maxFitJobIDs = 100

type jobFitResponse struct {
	JobID string `json:"jobId"`
	fitscore.Result
}

type jobFitBatchRequest struct {
	JobIDs []string `json:"jobIds"`
}

type jobFitBatchResponse struct {
	Scores []jobFitResponse `json:"scores"`
}

func (s *Server) getJobFit(w http.ResponseWriter, r *http.Request) {
	session, ok := authapi.Session(r.Context())
	if !ok {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	jobID := strings.TrimSpace(r.PathValue("jobId"))
	if jobID == "" {
		httpkit.WriteError(w, http.StatusBadRequest, "job id is required")
		return
	}
	job, err := s.lookupFitJob(ctx, jobID)
	if errors.Is(err, fitscore.ErrNotFound) || errors.Is(err, jobs.ErrNotFound) {
		httpkit.WriteError(w, http.StatusNotFound, "job not found")
		return
	}
	if err != nil {
		slog.Error("fit job", "error", err, "job", jobID)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load job")
		return
	}
	profile := s.lookupFitProfile(ctx, session.User.ID)
	httpkit.WriteJSON(w, http.StatusOK, s.scoreFit(ctx, job, profile))
}

func (s *Server) postJobFits(w http.ResponseWriter, r *http.Request) {
	session, ok := authapi.Session(r.Context())
	if !ok {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	var input jobFitBatchRequest
	if !decodeBody(w, r, &input) {
		return
	}
	ids := uniqueJobIDs(input.JobIDs)
	if len(ids) == 0 {
		httpkit.WriteError(w, http.StatusBadRequest, "jobIds is required")
		return
	}
	if len(ids) > maxFitJobIDs {
		httpkit.WriteError(w, http.StatusBadRequest, "too many job ids")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), httpkit.RequestTimeout)
	defer cancel()

	profile := s.lookupFitProfile(ctx, session.User.ID)
	out := make([]jobFitResponse, 0, len(ids))
	for _, id := range ids {
		job, err := s.lookupFitJob(ctx, id)
		if errors.Is(err, fitscore.ErrNotFound) || errors.Is(err, jobs.ErrNotFound) {
			continue
		}
		if err != nil {
			slog.Error("fit job", "error", err, "job", id)
			httpkit.WriteError(w, http.StatusInternalServerError, "could not load job")
			return
		}
		out = append(out, s.scoreFit(ctx, job, profile))
	}
	httpkit.WriteJSON(w, http.StatusOK, jobFitBatchResponse{Scores: out})
}

func (s *Server) scoreFit(ctx context.Context, job fitscore.Job, profile fitscore.Profile) jobFitResponse {
	result := fitscore.Score(job, profile)
	if s.fitReasoner != nil && killswitch.On(s.switches, ctx, killswitch.AcornAI) {
		text, err := s.fitReasoner.Rewrite(ctx, job, profile, result)
		if err != nil {
			slog.Warn("fit reasoner", "error", err, "job", job.ID)
		} else {
			result = fitscore.WithReason(result, text)
		}
	}
	if job.ID == "" {
		return jobFitResponse{Result: result}
	}
	return jobFitResponse{JobID: job.ID, Result: result}
}

func (s *Server) lookupFitJob(ctx context.Context, id string) (fitscore.Job, error) {
	if s.fitJobs != nil {
		return s.fitJobs.Job(ctx, id)
	}
	if s.store == nil {
		return fitscore.Job{}, fitscore.ErrNotFound
	}
	job, err := s.store.GetCatalogJob(ctx, id, time.Now())
	if err != nil {
		return fitscore.Job{}, err
	}
	return searchJobToFit(job.SearchJob), nil
}

func (s *Server) lookupFitProfile(ctx context.Context, userID string) fitscore.Profile {
	if s.fitProfiles != nil {
		profile, err := s.fitProfiles.Profile(ctx, userID)
		if err != nil {
			slog.Error("fit profile", "error", err, "user", userID)
			return fitscore.Profile{}
		}
		return profile
	}
	if s.people == nil {
		return fitscore.Profile{}
	}
	profile, err := s.people.GetProfile(ctx, userID, time.Now())
	if err != nil {
		slog.Error("fit profile", "error", err, "user", userID)
		return fitscore.Profile{}
	}
	return candidateToFitProfile(profile)
}

func searchJobToFit(job jobs.SearchJob) fitscore.Job {
	return fitscore.Job{
		ID:        job.ID,
		Title:     job.Title,
		Location:  job.Location,
		Workplace: job.Workplace,
		Seniority: job.Seniority,
		Skills:    job.Skills,
		PayMin:    job.Pay.Min,
		PayMax:    job.Pay.Max,
		PayPeriod: job.Pay.Period,
		Currency:  job.Pay.Currency,
		Visa:      job.Visa,
	}
}

func candidateToFitProfile(profile candidate.Profile) fitscore.Profile {
	titles := make([]string, 0, len(profile.Experience))
	for _, item := range profile.Experience {
		if role := strings.TrimSpace(item.Role); role != "" {
			titles = append(titles, role)
		}
	}
	locations := append([]string{}, profile.Locations...)
	if city := strings.TrimSpace(profile.HomeAddress.City); city != "" {
		locations = append(locations, city)
	}
	return fitscore.Profile{
		Headline:         profile.Headline,
		TargetRoles:      profile.TargetRoles,
		Locations:        locations,
		Location:         profile.Location,
		Workplace:        profile.Workplace,
		SalaryFloor:      profile.SalaryFloor,
		Skills:           profile.Skills,
		Authorization:    profile.Authorization,
		ExperienceTitles: titles,
	}
}

func uniqueJobIDs(ids []string) []string {
	out := make([]string, 0, len(ids))
	seen := map[string]struct{}{}
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
