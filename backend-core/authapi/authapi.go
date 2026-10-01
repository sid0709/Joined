package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/joined-backend/internal/auth"
)

const maxAuthBody = 16 << 10

type authResponse struct {
	Token   string       `json:"token,omitempty"`
	Session auth.Session `json:"session"`
}

func (s *Server) signup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Mode     string `json:"mode"`
		Company  *struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			URL  string `json:"url"`
		} `json:"company"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}
	input := auth.Signup{Name: body.Name, Email: body.Email, Password: body.Password, Mode: body.Mode}
	if body.Company != nil {
		input.Company = &auth.CompanyChoice{ID: body.Company.ID, Name: body.Company.Name, URL: body.Company.URL}
	}
	token, session, err := s.auth.Signup(r.Context(), input, time.Now())
	if err == nil && body.Company != nil && strings.TrimSpace(body.Company.ID) == "" {
		s.noteNewCompany(r.Context(), session)
	}
	writeAuthResult(w, token, session, err)
}

func (s *Server) signin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Audience string `json:"audience"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}
	s.writeAuth(w, func() (string, auth.Session, error) {
		return s.auth.Signin(r.Context(), body.Email, body.Password, body.Audience, time.Now())
	})
}

func (s *Server) signout(w http.ResponseWriter, r *http.Request) {
	if err := s.auth.Signout(r.Context(), bearerToken(r)); err != nil {
		slog.Error("sign out", "error", err)
		writeError(w, http.StatusInternalServerError, "could not sign out")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deleteAccount(w http.ResponseWriter, r *http.Request) {
	err := s.auth.DeleteAccount(r.Context(), bearerToken(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		writeError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	if err != nil {
		slog.Error("delete account", "error", err)
		writeError(w, http.StatusInternalServerError, "could not remove the account")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) session(w http.ResponseWriter, r *http.Request) {
	session, err := s.auth.Session(r.Context(), bearerToken(r), time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		writeError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	if err != nil {
		slog.Error("session", "error", err)
		writeError(w, http.StatusInternalServerError, "could not load the session")
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (s *Server) attachCompany(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		URL  string `json:"url"`
	}
	if !decodeAuth(w, r, &body) {
		return
	}
	session, err := s.auth.AttachCompany(r.Context(), bearerToken(r), auth.CompanyChoice{
		ID:   body.ID,
		Name: body.Name,
		URL:  body.URL,
	}, time.Now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		writeError(w, http.StatusUnauthorized, "sign in required")
		return
	}
	if err == nil && strings.TrimSpace(body.ID) == "" {
		s.noteNewCompany(r.Context(), session)
	}
	writeAuthResult(w, "", session, err)
}

func (s *Server) searchCompanies(w http.ResponseWriter, r *http.Request) {
	companies, err := s.auth.SearchCompanies(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		slog.Error("search companies", "error", err)
		writeError(w, http.StatusInternalServerError, "could not search companies")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"companies": companies})
}

func (s *Server) writeAuth(w http.ResponseWriter, issue func() (string, auth.Session, error)) {
	token, session, err := issue()
	writeAuthResult(w, token, session, err)
}

func writeAuthResult(w http.ResponseWriter, token string, session auth.Session, err error) {
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, authResponse{Token: token, Session: session})
	case errors.Is(err, auth.ErrEmailTaken):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, auth.ErrInvalidLogin):
		writeError(w, http.StatusUnauthorized, err.Error())
	case errors.Is(err, auth.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, auth.ErrNotFound):
		writeError(w, http.StatusNotFound, "company not found")
	case errors.Is(err, auth.ErrHasCompany):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, auth.ErrWrongRole):
		writeError(w, http.StatusForbidden, err.Error())
	default:
		slog.Error("auth", "error", err)
		writeError(w, http.StatusInternalServerError, "could not complete sign in")
	}
}

func decodeAuth(w http.ResponseWriter, r *http.Request, dest any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxAuthBody))
	if err := decoder.Decode(dest); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "invalid request")
		return false
	}
	return true
}

func bearerToken(r *http.Request) string {
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	token, ok := strings.CutPrefix(value, "Bearer ")
	if !ok {
		return ""
	}
	return strings.TrimSpace(token)
}
