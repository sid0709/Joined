package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/aisettings"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

const (
	acornAIPath       = "/v1/admin/acorn-ai"
	maxAcornAIBody    = 4 << 10
	noEncryptionKey   = "Set SETTINGS_ENCRYPTION_KEY (base64, 32 bytes: openssl rand -base64 32) in the admin API and core API environments to save a key"
	invalidAcornKey   = "The key can't contain spaces"
	unknownAcornModel = "Choose a model from the list"
)

func (s *Server) registerAcornAI(mux *http.ServeMux) {
	mux.HandleFunc("GET "+acornAIPath, s.getAcornAI)
	mux.HandleFunc("PUT "+acornAIPath, s.putAcornAI)
	mux.HandleFunc("DELETE "+acornAIPath, s.deleteAcornAI)
}

// acornAIView is the saved settings plus what the console needs to draw the form.
type acornAIView struct {
	aisettings.View
	// Models are the choices for the model dropdown.
	Models []string `json:"models"`
	// DefaultModel is what Acorn uses when no model is saved.
	DefaultModel string `json:"defaultModel"`
	// EnvKey is true when OPENAI_API_KEY is set, so Acorn works without a saved key.
	EnvKey bool `json:"envKey"`
}

func (s *Server) getAcornAI(w http.ResponseWriter, r *http.Request) {
	view, err := s.acornAI.View(r.Context())
	if err != nil {
		slog.Error("acorn ai settings", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load the AI settings")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, acornAIView{
		View:         view,
		Models:       aisettings.Options(s.acornAIEnv.Model, view.Model),
		DefaultModel: s.acornAIEnv.Model,
		EnvKey:       s.acornAIEnv.APIKey != "",
	})
}

// putAcornAI saves the API key and/or model. A field left out of the body is unchanged;
// a blank model returns to the default.
func (s *Server) putAcornAI(w http.ResponseWriter, r *http.Request) {
	var body struct {
		APIKey *string `json:"apiKey"`
		Model  *string `json:"model"`
	}
	if !httpkit.DecodeJSON(w, r, maxAcornAIBody, &body) {
		return
	}
	if body.APIKey == nil && body.Model == nil {
		httpkit.WriteError(w, http.StatusBadRequest, "send an apiKey or a model")
		return
	}
	if body.Model != nil && *body.Model != "" && !slices.Contains(aisettings.Options(s.acornAIEnv.Model), *body.Model) {
		httpkit.WriteError(w, http.StatusBadRequest, unknownAcornModel)
		return
	}
	s.saveAcornAI(w, r, aisettings.Update{APIKey: body.APIKey, Model: body.Model})
}

// deleteAcornAI removes the saved key; Acorn falls back to OPENAI_API_KEY.
func (s *Server) deleteAcornAI(w http.ResponseWriter, r *http.Request) {
	blank := ""
	s.saveAcornAI(w, r, aisettings.Update{APIKey: &blank})
}

func (s *Server) saveAcornAI(w http.ResponseWriter, r *http.Request, update aisettings.Update) {
	actor := adminActor(r)
	err := s.acornAI.Save(r.Context(), update, actor, time.Now())
	switch {
	case errors.Is(err, aisettings.ErrNoEncryptionKey):
		httpkit.WriteError(w, http.StatusServiceUnavailable, noEncryptionKey)
		return
	case errors.Is(err, aisettings.ErrInvalid):
		httpkit.WriteError(w, http.StatusBadRequest, invalidAcornKey)
		return
	case err != nil:
		slog.Error("save acorn ai settings", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not save the AI settings")
		return
	}
	slog.Info("acorn ai settings saved", "by", actor, "key", update.APIKey != nil, "model", update.Model != nil)
	s.getAcornAI(w, r)
}
