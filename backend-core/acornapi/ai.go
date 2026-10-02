package bashapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/auth"
	"github.com/sid0709/OpenSeat/backend-core/bash"
)

func decode(w http.ResponseWriter, r *http.Request, dest any) bool {
	err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody)).Decode(dest)
	if err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "invalid request")
		return false
	}
	return true
}

// writeBashError answers a failed model call: the caller's mistake, a missing
// model key, or the model itself failing.
func writeBashError(w http.ResponseWriter, route string, err error) {
	switch {
	case errors.Is(err, bash.ErrInvalid):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, bash.ErrModelUnavailable):
		writeError(w, http.StatusServiceUnavailable, err.Error())
	default:
		slog.Warn("bash route failed", "route", route, "error", err)
		writeError(w, http.StatusBadGateway, err.Error())
	}
}

// applicant renders the signed-in job hunter's Joined profile for the model.
func (s *Server) applicant(w http.ResponseWriter, r *http.Request, session auth.Session) (string, bool) {
	profile, err := s.people.GetProfile(r.Context(), session.User.ID, time.Now())
	if err != nil {
		slog.Error("bash profile", "user", session.User.ID, "error", err)
		writeError(w, http.StatusInternalServerError, "could not load the profile")
		return "", false
	}
	return bash.ApplicantProfileText(session.User.ID, profile), true
}

func (s *Server) aiAnalyze(w http.ResponseWriter, r *http.Request) {
	session, ok := s.session(w, r)
	if !ok {
		return
	}
	var body struct {
		PureTree string         `json:"pureTree"`
		MetaTree string         `json:"metaTree"` // accepted from older extensions, never sent to the model
		Page     map[string]any `json:"page"`
	}
	if !decode(w, r, &body) {
		return
	}
	applicant, ok := s.applicant(w, r, session)
	if !ok {
		return
	}
	result, err := s.bash.Analyze(r.Context(), applicant, body.PureTree, body.Page)
	if err != nil {
		writeBashError(w, "ai-analyze", err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) matchOption(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	var body struct {
		IntendedValue string   `json:"intendedValue"`
		Options       []string `json:"options"`
		FieldLabel    string   `json:"fieldLabel"`
		TypedQuery    string   `json:"typedQuery"`
	}
	if !decode(w, r, &body) {
		return
	}
	if strings.TrimSpace(body.IntendedValue) == "" || len(body.Options) == 0 {
		writeError(w, http.StatusBadRequest, "intendedValue and options are required")
		return
	}
	result, err := s.bash.MatchOption(r.Context(), body.IntendedValue, body.Options, body.FieldLabel, body.TypedQuery)
	if err != nil {
		// The extension falls back to its own matching, so a failure is data, not an HTTP error.
		slog.Warn("bash match-option failed", "error", err)
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "matched_option": nil, "confidence": 0, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) qa(w http.ResponseWriter, r *http.Request) {
	session, ok := s.session(w, r)
	if !ok {
		return
	}
	var body struct {
		Question string         `json:"question"`
		Page     map[string]any `json:"page"`
	}
	if !decode(w, r, &body) {
		return
	}
	applicant, ok := s.applicant(w, r, session)
	if !ok {
		return
	}
	result, err := s.bash.Answer(r.Context(), applicant, body.Question, body.Page)
	if err != nil {
		writeBashError(w, "qa", err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) extractJD(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	var body struct {
		PageText string `json:"pageText"`
		Meta     any    `json:"meta"`
	}
	if !decode(w, r, &body) {
		return
	}
	s.writeJD(w, r, body.PageText, body.Meta)
}

func (s *Server) analyzeMeta(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	var body struct {
		Meta any `json:"meta"`
	}
	if !decode(w, r, &body) {
		return
	}
	s.writeJD(w, r, "", body.Meta)
}

func (s *Server) writeJD(w http.ResponseWriter, r *http.Request, pageText string, meta any) {
	if len([]rune(pageText)) > bash.PageTextMaxChars {
		writeError(w, http.StatusBadRequest, "pageText is too long")
		return
	}
	result, err := s.bash.ExtractJD(r.Context(), pageText, meta)
	if err != nil {
		writeBashError(w, "extract-jd", err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
