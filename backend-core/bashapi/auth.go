package httpapi

import (
	"net/http"
)

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	// Liveness only: it must not disclose who is connected.
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// me is how the extension and UI board learn who the shared Joined session belongs to.
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	session, ok := s.session(w, r)
	if !ok {
		return
	}
	user := session.User
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"session": map[string]any{
			"accountId":   user.ID,
			"profileId":   user.ID,
			"applierName": user.Name,
			"username":    user.Email,
			"displayName": user.Name,
			"email":       user.Email,
			"role":        user.Role,
		},
	})
}

// signOut does not end the Joined session: Oak shares it with joined-frontend, so
// revoking it here would sign the person out of Joined too. The client forgets its copy.
func (s *Server) signOut(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.session(w, r); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}
