package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/aisettings"
	"github.com/sid0709/OpenSeat/backend-core/httpkit"
)

const (
	acornAIPath      = "/v1/admin/acorn-ai"
	deepSeekPath     = "/v1/admin/deepseek"
	maxModelBody     = 4 << 10
	noEncryptionKey  = "Set SETTINGS_ENCRYPTION_KEY (base64, 32 bytes: openssl rand -base64 32) in the admin API and core API environments to save a key"
	invalidModelKey  = "The key can't contain spaces"
	invalidModelName = "The model can't contain spaces"
	maxModelID       = 80
	modelsTimeout    = 20 * time.Second
)

// modelProvider is one console form: the saved document plus the environment it falls back to.
type modelProvider struct {
	store        *aisettings.Store
	defaultModel string
	baseURL      string
	envAPIKey    string
	logName      string
}

func (s *Server) registerAcornAI(mux *http.ServeMux) {
	s.registerModelSettings(mux, acornAIPath, s.acornProvider)
}

func (s *Server) registerDeepSeek(mux *http.ServeMux) {
	s.registerModelSettings(mux, deepSeekPath, s.deepSeekProvider)
}

func (s *Server) acornProvider() modelProvider {
	return modelProvider{
		store:        s.acornAI,
		defaultModel: s.acornAIEnv.Model,
		baseURL:      s.acornAIEnv.BaseURL,
		envAPIKey:    s.acornAIEnv.APIKey,
		logName:      "acorn ai",
	}
}

func (s *Server) deepSeekProvider() modelProvider {
	return modelProvider{
		store:        s.deepSeek,
		defaultModel: s.deepSeekEnv.Model,
		baseURL:      s.deepSeekEnv.BaseURL,
		envAPIKey:    s.deepSeekEnv.APIKey,
		logName:      "deepseek",
	}
}

func (s *Server) registerModelSettings(mux *http.ServeMux, path string, provider func() modelProvider) {
	mux.HandleFunc("GET "+path, func(w http.ResponseWriter, r *http.Request) {
		s.getModelSettings(w, r, provider())
	})
	mux.HandleFunc("GET "+path+"/models", func(w http.ResponseWriter, r *http.Request) {
		s.listProviderModels(w, r, provider())
	})
	mux.HandleFunc("PUT "+path, func(w http.ResponseWriter, r *http.Request) {
		s.putModelSettings(w, r, provider())
	})
	mux.HandleFunc("DELETE "+path, func(w http.ResponseWriter, r *http.Request) {
		s.deleteModelSettings(w, r, provider())
	})
}

// modelSettingsView is the saved settings plus what the console needs to draw the form.
type modelSettingsView struct {
	aisettings.View
	// Models are the models known without asking the provider: the default and the saved
	// one. The console adds the provider's live list from /models.
	Models []string `json:"models"`
	// DefaultModel is what the provider uses when no model is saved.
	DefaultModel string `json:"defaultModel"`
	// EnvKey is true when the environment already has an API key, so the feature works
	// without a saved one.
	EnvKey bool `json:"envKey"`
}

func (s *Server) getModelSettings(w http.ResponseWriter, r *http.Request, provider modelProvider) {
	view, err := provider.store.View(r.Context())
	if err != nil {
		slog.Error(provider.logName+" settings", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not load the AI settings")
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, modelSettingsView{
		View:         view,
		Models:       aisettings.Options(provider.defaultModel, view.Model),
		DefaultModel: provider.defaultModel,
		EnvKey:       provider.envAPIKey != "",
	})
}

// putModelSettings saves the API key and/or model. A field left out of the body is
// unchanged; a blank model returns to the default.
func (s *Server) putModelSettings(w http.ResponseWriter, r *http.Request, provider modelProvider) {
	var body struct {
		APIKey *string `json:"apiKey"`
		Model  *string `json:"model"`
	}
	if !httpkit.DecodeJSON(w, r, maxModelBody, &body) {
		return
	}
	if body.APIKey == nil && body.Model == nil {
		httpkit.WriteError(w, http.StatusBadRequest, "send an apiKey or a model")
		return
	}
	if body.Model != nil && (len(*body.Model) > maxModelID || strings.ContainsAny(*body.Model, " \t\r\n")) {
		httpkit.WriteError(w, http.StatusBadRequest, invalidModelName)
		return
	}
	s.saveModelSettings(w, r, provider, aisettings.Update{APIKey: body.APIKey, Model: body.Model})
}

// deleteModelSettings removes the saved key. The provider falls back to its environment key.
func (s *Server) deleteModelSettings(w http.ResponseWriter, r *http.Request, provider modelProvider) {
	blank := ""
	s.saveModelSettings(w, r, provider, aisettings.Update{APIKey: &blank})
}

func (s *Server) saveModelSettings(w http.ResponseWriter, r *http.Request, provider modelProvider, update aisettings.Update) {
	actor := adminActor(r)
	err := provider.store.Save(r.Context(), update, actor, time.Now())
	switch {
	case errors.Is(err, aisettings.ErrNoEncryptionKey):
		httpkit.WriteError(w, http.StatusServiceUnavailable, noEncryptionKey)
		return
	case errors.Is(err, aisettings.ErrInvalid):
		httpkit.WriteError(w, http.StatusBadRequest, invalidModelKey)
		return
	case err != nil:
		slog.Error("save "+provider.logName+" settings", "error", err)
		httpkit.WriteError(w, http.StatusInternalServerError, "could not save the AI settings")
		return
	}
	slog.Info(provider.logName+" settings saved", "by", actor, "key", update.APIKey != nil, "model", update.Model != nil)
	s.getModelSettings(w, r, provider)
}

// listProviderModels asks the provider which models the key can use, newest first.
// It uses the saved key, else the environment's, so the dropdown shows what is available.
func (s *Server) listProviderModels(w http.ResponseWriter, r *http.Request, provider modelProvider) {
	ctx, cancel := context.WithTimeout(r.Context(), modelsTimeout)
	defer cancel()
	key := provider.envAPIKey
	if saved, err := provider.store.Get(ctx); err == nil && saved.APIKey != "" {
		key = saved.APIKey
	}
	models, err := aisettings.ListModels(ctx, provider.baseURL, key)
	switch {
	case errors.Is(err, aisettings.ErrNoKey):
		httpkit.WriteJSON(w, http.StatusOK, map[string]any{"models": []string{}, "reason": "Save an API key to load the model list."})
		return
	case err != nil:
		slog.Warn("list "+provider.logName+" models", "error", err)
		httpkit.WriteJSON(w, http.StatusOK, map[string]any{"models": []string{}, "reason": "Couldn't load the model list: " + err.Error() + "."})
		return
	}
	httpkit.WriteJSON(w, http.StatusOK, map[string]any{"models": models})
}
