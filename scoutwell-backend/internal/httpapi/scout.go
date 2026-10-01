package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
	"github.com/sid0709/OpenSeat/backend-core/scout"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// maxBatchBody leaves room for MaxBatchSize full submissions.
const maxBatchBody = 512 << 10

// Which callers an endpoint accepts. API keys only reach the submission API;
// account, money, and key management need a signed-in person.
const (
	sessionOnly  = false
	sessionOrKey = true
)

func (s *Server) registerScout(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/scout/meta", s.scoutMeta)
	mux.HandleFunc("GET /v1/scout/me", s.scoutMe)
	mux.HandleFunc("PATCH /v1/scout/me", s.scoutPatchMe)
	mux.HandleFunc("POST /v1/scout/me/terms", s.scoutAcceptTerms)
	mux.HandleFunc("POST /v1/scout/me/verification", s.scoutRequestVerification)
	mux.HandleFunc("PUT /v1/scout/me/tax", s.scoutSaveTax)
	mux.HandleFunc("PUT /v1/scout/me/payout-method", s.scoutSavePayoutMethod)
	mux.HandleFunc("GET /v1/scout/companies", s.scoutSearchCompanies)
	mux.HandleFunc("POST /v1/scout/companies", s.scoutCreateCompany)
	mux.HandleFunc("GET /v1/scout/stats", s.scoutStats)
	mux.HandleFunc("POST /v1/scout/submissions", s.scoutSubmit)
	mux.HandleFunc("POST /v1/scout/submissions/batch", s.scoutSubmitBatch)
	mux.HandleFunc("POST /v1/scout/submissions/precheck", s.scoutPrecheck)
	mux.HandleFunc("POST /v1/scout/submissions/matches", s.scoutMatches)
	mux.HandleFunc("GET /v1/scout/submissions", s.scoutListSubmissions)
	mux.HandleFunc("GET /v1/scout/submissions/{id}", s.scoutGetSubmission)
	mux.HandleFunc("GET /v1/scout/earnings", s.scoutEarnings)
	mux.HandleFunc("GET /v1/scout/payouts", s.scoutPayouts)
	mux.HandleFunc("POST /v1/scout/payouts", s.scoutRequestPayout)
	mux.HandleFunc("GET /v1/scout/notifications", s.scoutNotifications)
	mux.HandleFunc("POST /v1/scout/notifications/read", s.scoutMarkRead)
	mux.HandleFunc("GET /v1/scout/api-keys", s.scoutListKeys)
	mux.HandleFunc("POST /v1/scout/api-keys", s.scoutCreateKey)
	mux.HandleFunc("DELETE /v1/scout/api-keys/{id}", s.scoutRevokeKey)
}

// scoutActor resolves the bearer token to a scout: a web session, or an API
// key when the endpoint allows keys.
func (s *Server) scoutActor(w http.ResponseWriter, r *http.Request, allowKeys bool) (scout.Actor, bool) {
	token := httpkit.BearerToken(r)
	if token == "" {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusUnauthorized, "unauthorized", "Send Authorization: Bearer <session token or API key>."))
		return scout.Actor{}, false
	}
	if scout.IsAPIKey(token) {
		if !allowKeys {
			httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusForbidden, "forbidden", "API keys cannot use this endpoint; sign in to Scoutwell."))
			return scout.Actor{}, false
		}
		actor, err := s.scouts.Authenticate(r.Context(), token)
		if err != nil {
			httpkit.WriteScoutError(w, err)
			return scout.Actor{}, false
		}
		return actor, true
	}
	userID, err := s.auth.SessionUserID(r.Context(), token, time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusUnauthorized, "unauthorized", "Session expired or invalid; sign in again."))
		return scout.Actor{}, false
	}
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return scout.Actor{}, false
	}
	return scout.Actor{UserID: userID}, true
}

func (s *Server) scoutMeta(w http.ResponseWriter, r *http.Request) {
	httpkit.WriteJSON(w, http.StatusOK, scout.Rulebook())
}

func (s *Server) scoutMe(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOrKey)
	if !ok {
		return
	}
	profile, err := s.scouts.EnsureProfile(r.Context(), actor.UserID)
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, profile)
}

func (s *Server) scoutPatchMe(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	var patch scout.ProfilePatch
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &patch) {
		return
	}
	s.writeProfile(w, func() (scout.Profile, error) { return s.scouts.UpdateProfile(r.Context(), actor.UserID, patch) })
}

func (s *Server) scoutAcceptTerms(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	s.writeProfile(w, func() (scout.Profile, error) { return s.scouts.AcceptTerms(r.Context(), actor.UserID) })
}

func (s *Server) scoutRequestVerification(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	var input scout.VerificationRequest
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	s.writeProfile(w, func() (scout.Profile, error) {
		return s.scouts.RequestVerification(r.Context(), actor.UserID, input)
	})
}

func (s *Server) scoutSaveTax(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	var input scout.TaxInput
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	s.writeProfile(w, func() (scout.Profile, error) { return s.scouts.SaveTaxInfo(r.Context(), actor.UserID, input) })
}

func (s *Server) scoutSavePayoutMethod(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	var input scout.PayoutMethodInput
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	s.writeProfile(w, func() (scout.Profile, error) {
		return s.scouts.SavePayoutMethod(r.Context(), actor.UserID, input)
	})
}

func (s *Server) writeProfile(w http.ResponseWriter, run func() (scout.Profile, error)) {
	profile, err := run()
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, profile)
}

func (s *Server) scoutStats(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOrKey)
	if !ok {
		return
	}
	stats, err := s.scouts.Stats(r.Context(), actor.UserID)
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.SetQuotaHeaders(w, stats.Quota)
	httpkit.WriteJSON(w, http.StatusOK, stats)
}

// idempotent runs a create endpoint once per Idempotency-Key.
func (s *Server) idempotent(w http.ResponseWriter, r *http.Request, actor scout.Actor, body []byte, run func() (int, any)) {
	key := strings.TrimSpace(r.Header.Get(httpkit.IdempotencyHeader))
	respond := func() scout.Replay {
		status, value := run()
		encoded, err := json.Marshal(value)
		if err != nil {
			slog.Error("encode response", "error", err)
			encoded, _ = json.Marshal(httpkit.NewProblem(http.StatusInternalServerError, "internal_error", "Something went wrong. Try again."))
			status = http.StatusInternalServerError
		}
		return scout.Replay{Status: status, Body: encoded}
	}
	var replay scout.Replay
	if key == "" {
		replay = respond()
	} else {
		if !scout.ValidIdempotencyKey(key) {
			httpkit.WriteProblem(w, httpkit.NewProblem(http.StatusBadRequest, "invalid_request", "Idempotency-Key must be 1 to 255 characters."))
			return
		}
		var replayed bool
		var err error
		replay, replayed, err = s.scouts.Idempotent(r.Context(), actor.UserID, r.URL.Path, key, body, respond)
		if err != nil {
			httpkit.WriteScoutError(w, err)
			return
		}
		if replayed {
			w.Header().Set("Idempotent-Replayed", "true")
		}
	}
	contentType := "application/json"
	if replay.Status >= http.StatusBadRequest {
		contentType = httpkit.ProblemContentType
	}
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(replay.Status)
	if _, err := w.Write(replay.Body); err != nil {
		slog.Error("write response", "error", err)
	}
}

func (s *Server) scoutSubmit(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOrKey)
	if !ok {
		return
	}
	body, ok := httpkit.ReadBody(w, r, httpkit.MaxWriteBody)
	if !ok {
		return
	}
	s.idempotent(w, r, actor, body, func() (int, any) {
		var input scout.SubmissionInput
		if err := json.NewDecoder(bytes.NewReader(body)).Decode(&input); err != nil {
			return http.StatusBadRequest, httpkit.NewProblem(http.StatusBadRequest, "invalid_request", "Body must be valid JSON.")
		}
		sub, err := s.scouts.Submit(r.Context(), actor, input)
		if err != nil {
			var quota *scout.QuotaError
			if errors.As(err, &quota) {
				httpkit.SetQuotaHeaders(w, quota.Quota)
			}
			p := httpkit.ScoutProblem(err)
			return p.Status, p
		}
		if quota, err := s.scouts.Quota(r.Context(), actor.UserID); err == nil {
			httpkit.SetQuotaHeaders(w, quota)
		}
		w.Header().Set("Location", "/v1/scout/submissions/"+sub.ID)
		return http.StatusCreated, sub
	})
}

func (s *Server) scoutSubmitBatch(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOrKey)
	if !ok {
		return
	}
	body, ok := httpkit.ReadBody(w, r, maxBatchBody)
	if !ok {
		return
	}
	s.idempotent(w, r, actor, body, func() (int, any) {
		var input struct {
			Submissions []scout.SubmissionInput `json:"submissions"`
		}
		if err := json.NewDecoder(bytes.NewReader(body)).Decode(&input); err != nil {
			return http.StatusBadRequest, httpkit.NewProblem(http.StatusBadRequest, "invalid_request", "Body must be valid JSON.")
		}
		results, err := s.scouts.SubmitBatch(r.Context(), actor, input.Submissions)
		if err != nil {
			p := httpkit.ScoutProblem(err)
			return p.Status, p
		}
		accepted := 0
		for _, result := range results {
			if result.Submission != nil {
				accepted++
			}
		}
		if quota, err := s.scouts.Quota(r.Context(), actor.UserID); err == nil {
			httpkit.SetQuotaHeaders(w, quota)
		}
		return http.StatusMultiStatus, map[string]any{"accepted": accepted, "rejected": len(results) - accepted, "results": results}
	})
}

func (s *Server) scoutPrecheck(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.scoutActor(w, r, sessionOrKey); !ok {
		return
	}
	var input struct {
		URL string `json:"url"`
	}
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	result, err := s.scouts.Precheck(r.Context(), input.URL)
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, result)
}

func (s *Server) scoutMatches(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.scoutActor(w, r, sessionOrKey); !ok {
		return
	}
	var input scout.MatchQuery
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	matches, err := s.scouts.FindMatches(r.Context(), input, bson.ObjectID{})
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	if matches == nil {
		matches = []scout.Match{}
	}
	httpkit.WriteJSON(w, http.StatusOK, scout.MatchResult{Matches: matches})
}

func (s *Server) scoutListSubmissions(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOrKey)
	if !ok {
		return
	}
	query := r.URL.Query()
	parsed := scout.SubmissionQuery{
		Status:      query.Get("status"),
		Cursor:      query.Get("cursor"),
		Limit:       atoi(query.Get("limit")),
		ExternalRef: query.Get("external_ref"),
	}
	if since := query.Get("updated_since"); since != "" {
		at, err := time.Parse(time.RFC3339, since)
		if err != nil {
			httpkit.WriteScoutError(w, &scout.ValidationError{Fields: []scout.FieldError{{Field: "updated_since", Detail: "use an RFC 3339 time, like 2026-09-28T00:00:00Z"}}})
			return
		}
		parsed.UpdatedSince = &at
	}
	list, err := s.scouts.ListSubmissions(r.Context(), actor.UserID, parsed)
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, list)
}

func (s *Server) scoutGetSubmission(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOrKey)
	if !ok {
		return
	}
	sub, err := s.scouts.GetSubmission(r.Context(), actor.UserID, r.PathValue("id"))
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, sub)
}

func (s *Server) scoutEarnings(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOrKey)
	if !ok {
		return
	}
	query := r.URL.Query()
	list, err := s.scouts.ListEarnings(r.Context(), actor.UserID, scout.EarningQuery{
		Status:       query.Get("status"),
		SubmissionID: query.Get("submission_id"),
		Cursor:       query.Get("cursor"),
		Limit:        atoi(query.Get("limit")),
	})
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, list)
}

func (s *Server) scoutPayouts(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	query := r.URL.Query()
	list, err := s.scouts.ListPayouts(r.Context(), actor.UserID, query.Get("cursor"), atoi(query.Get("limit")))
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, list)
}

func (s *Server) scoutRequestPayout(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	payout, err := s.scouts.RequestPayout(r.Context(), actor.UserID)
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusCreated, payout)
}

func (s *Server) scoutNotifications(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	query := r.URL.Query()
	list, err := s.scouts.ListNotifications(r.Context(), actor.UserID, query.Get("cursor"), atoi(query.Get("limit")))
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, list)
}

func (s *Server) scoutMarkRead(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	var input struct {
		IDs []string `json:"ids"`
	}
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	if err := s.scouts.MarkRead(r.Context(), actor.UserID, input.IDs); err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) scoutListKeys(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	keys, err := s.scouts.ListAPIKeys(r.Context(), actor.UserID)
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"data": keys})
}

func (s *Server) scoutCreateKey(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	var input struct {
		Name string `json:"name"`
	}
	if !httpkit.DecodeJSON(w, r, httpkit.MaxWriteBody, &input) {
		return
	}
	key, err := s.scouts.CreateAPIKey(r.Context(), actor.UserID, input.Name)
	if err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	httpkit.WriteJSON(w, http.StatusCreated, key)
}

func (s *Server) scoutRevokeKey(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.scoutActor(w, r, sessionOnly)
	if !ok {
		return
	}
	if err := s.scouts.RevokeAPIKey(r.Context(), actor.UserID, r.PathValue("id")); err != nil {
		httpkit.WriteScoutError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func atoi(value string) int {
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return n
}
