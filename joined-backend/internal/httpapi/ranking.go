package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/Joined/backend-core/auth"
	"github.com/sid0709/Joined/backend-core/authapi"
	"github.com/sid0709/Joined/backend-core/fitscore"
	"github.com/sid0709/Joined/backend-core/httpkit"
	"github.com/sid0709/Joined/backend-core/jobs"
	"github.com/sid0709/Joined/backend-core/ranking"
)

// privateCache keeps a personalized result out of every shared cache.
const privateCache = "private, no-store"

// rankedSearchResponse is GET /v1/search/jobs when ranking serves it. The first
// four fields match the Mongo search response, so older clients read either.
type rankedSearchResponse struct {
	Jobs        any                        `json:"jobs"`
	Total       int                        `json:"total"`
	HasMore     bool                       `json:"hasMore"`
	Exact       bool                       `json:"exact"`
	Fits        map[string]fitscore.Result `json:"fits,omitempty"`
	Facets      *ranking.Facets            `json:"facets,omitempty"`
	Suggestions []ranking.Suggestion       `json:"suggestions,omitempty"`
	RankingID   string                     `json:"rankingId,omitempty"`
	Mode        string                     `json:"mode,omitempty"`
	Timing      map[string]float64         `json:"timing,omitempty"`
}

// fallbackSearchResponse is the Mongo search with fit scores attached for a signed-in hunter.
type fallbackSearchResponse struct {
	jobs.SearchResults
	Fits map[string]fitscore.Result `json:"fits,omitempty"`
}

// searchViewer is who is behind a search. userID is the signed-in job hunter, or
// "" for anyone else; signedIn is any valid session, a hiring account included.
// A missing or invalid token is a visitor, never an error.
func (s *Server) searchViewer(r *http.Request) (userID string, signedIn bool) {
	session, ok := authapi.Session(r.Context())
	if !ok {
		token := httpkit.BearerToken(r)
		if token == "" || s.sessions == nil {
			return "", false
		}
		var err error
		if session, err = s.sessions.Session(r.Context(), token, time.Now()); err != nil {
			return "", false
		}
	}
	if session.User.Role != auth.RoleCandidate {
		return "", true
	}
	return session.User.ID, true
}

// searchUnavailableMessage answers a ranked search whose jobs could not be read.
const searchUnavailableMessage = "search is temporarily unavailable"

// rankedSearch serves a search from the ranking service. ok is false when ranking
// cannot serve it and the caller should use the Mongo search; a hydration failure
// is answered here with 503.
func (s *Server) rankedSearch(ctx context.Context, w http.ResponseWriter, query jobs.SearchQuery, userID string) bool {
	if s.ranker == nil {
		return false
	}
	now := time.Now()
	result, err := s.ranker.Search(ctx, ranking.RequestFromQuery(query, userID, now))
	if errors.Is(err, ranking.ErrFallback) {
		slog.Warn("ranked search fallback", "reason", err)
		return false
	}
	if err != nil {
		slog.Error("ranked search", "error", err)
		return false
	}
	loaded, err := s.store.CatalogJobsByObjectIDs(ctx, result.ObjectIDs, now)
	if err != nil {
		// The Mongo search reads the same database: falling back would only double
		// the load on it. Answer now so the client can retry.
		slog.Error("ranked search hydrate", "error", err)
		httpkit.WriteError(w, http.StatusServiceUnavailable, searchUnavailableMessage)
		return true
	}
	if userID != "" {
		w.Header().Set("Cache-Control", privateCache)
	}
	httpkit.WriteJSON(w, http.StatusOK, rankedSearchResponse{
		Jobs:        loaded,
		Total:       result.Total,
		HasMore:     result.HasMore,
		Exact:       result.Exact,
		Fits:        result.Fits,
		Facets:      result.Facets,
		Suggestions: result.Suggestions,
		RankingID:   result.RankingID,
		Mode:        result.Mode,
		Timing:      result.Timing,
	})
	return true
}

// pageFits scores a page of jobs for a signed-in hunter (the Mongo fallback path).
func (s *Server) pageFits(ctx context.Context, userID string, page []jobs.SearchJob) map[string]fitscore.Result {
	if userID == "" || len(page) == 0 {
		return nil
	}
	profile := s.lookupFitProfile(ctx, userID)
	out := make(map[string]fitscore.Result, len(page))
	for _, job := range page {
		out[job.ID] = fitscore.Score(searchJobToFit(job), profile)
	}
	return out
}

type rankingEventRequest struct {
	RankingID string `json:"rankingId"`
	JobID     string `json:"jobId"`
	Type      string `json:"type"`
	Position  int    `json:"position"`
}

// postRankingEvent records a click, save, apply, or dismiss on a ranked result.
func (s *Server) postRankingEvent(w http.ResponseWriter, r *http.Request) {
	session, ok := authapi.Session(r.Context())
	if !ok {
		httpkit.WriteError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	var input rankingEventRequest
	if !decodeBody(w, r, &input) {
		return
	}
	if s.ranker == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	err := s.ranker.LogInteraction(session.User.ID, strings.TrimSpace(input.RankingID), strings.TrimSpace(input.JobID), strings.TrimSpace(input.Type), input.Position, time.Now())
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// noteProfileChanged refreshes a hunter's ranking after their profile is saved.
func (s *Server) noteProfileChanged(userID string) {
	if s.ranker != nil {
		s.ranker.ProfileChanged(userID)
	}
}
