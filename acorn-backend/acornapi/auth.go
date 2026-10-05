package acornapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/sid0709/OpenSeat/acorn-backend/account"
)

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	// Liveness only: it must not disclose who is connected.
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) signUp(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decode(w, r, &body) {
		return
	}
	token, user, err := s.accounts.SignUp(r.Context(), body.Name, body.Email, body.Password, time.Now())
	if err != nil {
		writeAccountError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sessionBody(token, user))
}

func (s *Server) signIn(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decode(w, r, &body) {
		return
	}
	token, user, err := s.accounts.SignIn(r.Context(), body.Email, body.Password, time.Now())
	if err != nil {
		writeAccountError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionBody(token, user))
}

// me is how the extension and acorn-frontend learn who the Acorn session belongs to.
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	session, ok := s.session(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, sessionBody("", session.User))
}

// signOut ends this Acorn session. acorn-frontend and the extension both drop the cookie.
func (s *Server) signOut(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	if err := s.accounts.Revoke(r.Context(), s.token(r)); err != nil {
		writeError(w, http.StatusInternalServerError, "could not sign out")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func sessionBody(token string, user account.User) map[string]any {
	body := map[string]any{
		"success": true,
		"session": map[string]any{
			"accountId":   user.ID,
			"profileId":   user.ID,
			"applierName": user.Name,
			"username":    user.Email,
			"displayName": user.Name,
			"email":       user.Email,
		},
	}
	if token != "" {
		body["token"] = token
	}
	return body
}

func writeAccountError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, account.ErrEmailTaken):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, account.ErrWeakPassword), errors.Is(err, account.ErrInvalid):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, account.ErrInvalidLogin):
		writeError(w, http.StatusUnauthorized, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "could not sign in")
	}
}
