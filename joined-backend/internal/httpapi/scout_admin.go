package httpapi

import (
	"context"
	"crypto/subtle"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/sid0709/OpenSeat/joined-backend/internal/jobs"
	"github.com/sid0709/OpenSeat/joined-backend/internal/scout"
)

const (
	adminActorHeader = "X-Admin-Actor"
	defaultActor     = "admin"
	maxActorLength   = 80
)

func (s *Server) registerScoutAdmin(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/admin/scout/meta", s.admin(s.scoutMeta))
	mux.HandleFunc("GET /v1/admin/scout/overview", s.admin(s.adminScoutOverview))
	mux.HandleFunc("GET /v1/admin/scout/submissions", s.admin(s.adminScoutSubmissions))
	mux.HandleFunc("GET /v1/admin/scout/submissions/{id}", s.admin(s.adminScoutSubmission))
	mux.HandleFunc("POST /v1/admin/scout/submissions/{id}/review", s.admin(s.adminScoutReview))
	mux.HandleFunc("POST /v1/admin/scout/submissions/{id}/analyze", s.admin(s.adminScoutAnalyze))
	mux.HandleFunc("POST /v1/admin/scout/submissions/{id}/compare-matches", s.admin(s.adminScoutCompareMatches))
	mux.HandleFunc("POST /v1/admin/scout/submissions/{id}/expire", s.admin(s.adminScoutExpire))
	mux.HandleFunc("POST /v1/admin/scout/submissions/{id}/outcomes", s.admin(s.adminScoutOutcome))
	mux.HandleFunc("POST /v1/admin/scout/submissions/{id}/recheck", s.admin(s.adminScoutRecheck))
	mux.HandleFunc("GET /v1/admin/scout/scouts", s.admin(s.adminScouts))
	mux.HandleFunc("GET /v1/admin/scout/scouts/{userId}", s.admin(s.adminScout))
	mux.HandleFunc("PATCH /v1/admin/scout/scouts/{userId}", s.admin(s.adminPatchScout))
	mux.HandleFunc("GET /v1/admin/scout/payouts", s.admin(s.adminPayouts))
	mux.HandleFunc("POST /v1/admin/scout/payouts/{id}/decision", s.admin(s.adminDecidePayout))
}

// admin guards staff endpoints. When ADMIN_API_TOKEN is configured, callers
// must send it as a bearer token; the admin console adds it server-side.
func (s *Server) admin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.adminToken != "" {
			token := bearerToken(r)
			if subtle.ConstantTimeCompare([]byte(token), []byte(s.adminToken)) != 1 {
				writeError(w, http.StatusUnauthorized, "admin token required")
				return
			}
		}
		next(w, r)
	}
}

// adminActor is who made a staff decision, for the audit log.
func adminActor(r *http.Request) string {
	value := strings.TrimSpace(r.Header.Get(adminActorHeader))
	value = strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, value)
	if value == "" {
		return defaultActor
	}
	if len(value) > maxActorLength {
		value = value[:maxActorLength]
	}
	return value
}

func pageQuery(r *http.Request) (int64, int64) {
	query := r.URL.Query()
	page, _ := strconv.ParseInt(query.Get("page"), 10, 64)
	size, _ := strconv.ParseInt(query.Get("page_size"), 10, 64)
	return page, size
}

func (s *Server) adminScoutOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := s.scouts.AdminOverview(r.Context())
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, overview)
}

func (s *Server) adminScoutSubmissions(w http.ResponseWriter, r *http.Request) {
	page, size := pageQuery(r)
	query := r.URL.Query()
	list, err := s.scouts.AdminListSubmissions(r.Context(), scout.AdminSubmissionQuery{
		Status:   query.Get("status"),
		Channel:  query.Get("channel"),
		Q:        query.Get("q"),
		Page:     page,
		PageSize: size,
	})
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) adminScoutSubmission(w http.ResponseWriter, r *http.Request) {
	detail, err := s.scouts.AdminSubmission(r.Context(), r.PathValue("id"))
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (s *Server) adminScoutReview(w http.ResponseWriter, r *http.Request) {
	var input scout.ReviewInput
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	sub, err := s.scouts.Review(r.Context(), r.PathValue("id"), adminActor(r), input)
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

func (s *Server) adminScoutAnalyze(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Edits           *scout.SubmissionInput `json:"edits"`
		ContinueExtract bool                   `json:"continue_extract"`
	}
	if !decodeScout(w, r, maxWriteBody, &body) {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), analyzeTimeout)
	defer cancel()
	now := time.Now()
	sub, result, err := s.scouts.Analyze(ctx, r.PathValue("id"), adminActor(r), body.Edits, now, func(listing jobs.ScoutedListing, tempJobID string) (jobs.AnalyzeScoutedResult, error) {
		return s.store.AnalyzeScouted(ctx, s.reader, listing, tempJobID, now, body.ContinueExtract)
	})
	if jobs.IsMissingAPIKey(err) {
		writeError(w, http.StatusServiceUnavailable, "Set OPENAI_API_KEY in the admin API environment")
		return
	}
	if err != nil {
		slog.Error("analyze scout submission", "error", err)
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"submission": sub,
		"record":     result.Record,
		"duplicate":  result.Duplicate,
		"top_k":      result.TopK,
	})
}

func (s *Server) adminScoutCompareMatches(w http.ResponseWriter, r *http.Request) {
	if s.reader == nil {
		writeError(w, http.StatusServiceUnavailable, "Set OPENAI_API_KEY in the admin API environment")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), analyzeTimeout)
	defer cancel()
	compares, err := s.scouts.CompareMatches(ctx, r.PathValue("id"), s.reader)
	if jobs.IsMissingAPIKey(err) {
		writeError(w, http.StatusServiceUnavailable, "Set OPENAI_API_KEY in the admin API environment")
		return
	}
	if err != nil {
		slog.Error("compare scout matches", "error", err)
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"compares": compares})
}

func (s *Server) adminScoutExpire(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Note string `json:"note"`
	}
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	sub, err := s.scouts.Expire(r.Context(), r.PathValue("id"), adminActor(r), input.Note)
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

func (s *Server) adminScoutOutcome(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Type string `json:"type"`
	}
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	sub, err := s.scouts.RecordOutcome(r.Context(), r.PathValue("id"), adminActor(r), input.Type)
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

func (s *Server) adminScoutRecheck(w http.ResponseWriter, r *http.Request) {
	sub, err := s.scouts.Recheck(r.Context(), r.PathValue("id"), adminActor(r))
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

func (s *Server) adminScouts(w http.ResponseWriter, r *http.Request) {
	page, size := pageQuery(r)
	query := r.URL.Query()
	list, err := s.scouts.AdminListScouts(r.Context(), scout.AdminScoutQuery{
		Q:            query.Get("q"),
		Level:        query.Get("level"),
		Verification: query.Get("verification"),
		Page:         page,
		PageSize:     size,
	})
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) adminScout(w http.ResponseWriter, r *http.Request) {
	detail, err := s.scouts.AdminScout(r.Context(), r.PathValue("userId"))
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (s *Server) adminPatchScout(w http.ResponseWriter, r *http.Request) {
	var patch scout.ScoutPatch
	if !decodeScout(w, r, maxWriteBody, &patch) {
		return
	}
	detail, err := s.scouts.UpdateScout(r.Context(), r.PathValue("userId"), adminActor(r), patch)
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (s *Server) adminPayouts(w http.ResponseWriter, r *http.Request) {
	page, size := pageQuery(r)
	list, err := s.scouts.AdminListPayouts(r.Context(), r.URL.Query().Get("status"), page, size)
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) adminDecidePayout(w http.ResponseWriter, r *http.Request) {
	var input scout.PayoutDecision
	if !decodeScout(w, r, maxWriteBody, &input) {
		return
	}
	payout, err := s.scouts.DecidePayout(r.Context(), r.PathValue("id"), adminActor(r), input)
	if err != nil {
		writeScoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, payout)
}
