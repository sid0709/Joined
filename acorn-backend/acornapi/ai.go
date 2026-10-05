package acornapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/sid0709/OpenSeat/acorn-backend/account"
	"github.com/sid0709/OpenSeat/acorn-backend/acorn"
	"github.com/sid0709/OpenSeat/backend-core/candidate"
)

func decode(w http.ResponseWriter, r *http.Request, dest any) bool {
	err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody)).Decode(dest)
	if err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "invalid request")
		return false
	}
	return true
}

// writeAcornError answers a failed model call: the caller's mistake, a missing
// model key, or the model itself failing.
func writeAcornError(w http.ResponseWriter, route string, err error) {
	switch {
	case errors.Is(err, acorn.ErrInvalid):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, acorn.ErrModelUnavailable):
		writeError(w, http.StatusServiceUnavailable, err.Error())
	default:
		slog.Warn("acorn route failed", "route", route, "error", err)
		writeError(w, http.StatusBadGateway, err.Error())
	}
}

// applicant renders the signed-in Acorn account for the model. Name and email come
// from that account; a fuller profile editor is not on this API yet.
func (s *Server) applicant(_ http.ResponseWriter, _ *http.Request, session account.Session) (string, bool) {
	profile := candidate.Profile{Name: session.User.Name, Email: session.User.Email}
	return acorn.ApplicantProfileText(session.User.ID, profile), true
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
	result, err := s.acorn.Analyze(r.Context(), applicant, body.PureTree, body.Page)
	if err != nil {
		writeAcornError(w, "ai-analyze", err)
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
	result, err := s.acorn.MatchOption(r.Context(), body.IntendedValue, body.Options, body.FieldLabel, body.TypedQuery)
	if err != nil {
		// The extension falls back to its own matching, so a failure is data, not an HTTP error.
		slog.Warn("acorn match-option failed", "error", err)
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
	result, err := s.acorn.Answer(r.Context(), applicant, body.Question, body.Page)
	if err != nil {
		writeAcornError(w, "qa", err)
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
	if len([]rune(pageText)) > acorn.PageTextMaxChars {
		writeError(w, http.StatusBadRequest, "pageText is too long")
		return
	}
	result, err := s.acorn.ExtractJD(r.Context(), pageText, meta)
	if err != nil {
		writeAcornError(w, "extract-jd", err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
