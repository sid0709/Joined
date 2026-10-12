package deepseek

import (
	"context"
	"errors"
	"testing"

	"github.com/sid0709/Joined/backend-core/aisettings"
	"github.com/sid0709/Joined/backend-core/config"
)

type fakeLoader struct {
	settings aisettings.Settings
	err      error
}

func (f *fakeLoader) Get(context.Context) (aisettings.Settings, error) {
	return f.settings, f.err
}

func fallback() config.OpenRouter {
	return config.OpenRouter{
		APIKey:      "env-key",
		Model:       "deepseek/deepseek-chat",
		BaseURL:     "https://openrouter.ai/api/v1",
		MaxSearches: 4,
	}
}

func TestReloadingPrefersSavedSettingsAndFallsBack(t *testing.T) {
	env := fallback()

	empty := NewReloading(&fakeLoader{}, env).current()
	if !empty.Ready() || empty.Model() != "deepseek/deepseek-chat" || empty.apiKey != "env-key" {
		t.Errorf("no saved settings: ready=%v model=%q key=%q", empty.Ready(), empty.Model(), empty.apiKey)
	}
	if empty.baseURL != env.BaseURL || empty.maxSearches != env.MaxSearches {
		t.Errorf("search stayed on the environment: url=%q cap=%d", empty.baseURL, empty.maxSearches)
	}

	saved := NewReloading(&fakeLoader{settings: aisettings.Settings{APIKey: "db-key", Model: "openai/gpt-4o-mini"}}, env).current()
	if saved.apiKey != "db-key" || saved.Model() != "openai/gpt-4o-mini" || saved.baseURL != env.BaseURL {
		t.Errorf("saved settings: key=%q model=%q base=%q", saved.apiKey, saved.Model(), saved.baseURL)
	}

	none := NewReloading(&fakeLoader{}, config.OpenRouter{Model: "deepseek/deepseek-chat"}).current()
	if none.Ready() {
		t.Error("no key anywhere must not be ready")
	}
	keyOnly := NewReloading(&fakeLoader{settings: aisettings.Settings{APIKey: "db-key"}}, env).current()
	if !keyOnly.Ready() || keyOnly.apiKey != "db-key" || keyOnly.Model() != "deepseek/deepseek-chat" {
		t.Errorf("saved key with env model: ready=%v key=%q model=%q", keyOnly.Ready(), keyOnly.apiKey, keyOnly.Model())
	}
}

func TestReloadingPicksUpAChangeAndSurvivesALoadError(t *testing.T) {
	loader := &fakeLoader{settings: aisettings.Settings{APIKey: "one", Model: "m1"}}
	client := NewReloading(loader, fallback())
	if client.current().apiKey != "one" {
		t.Fatal("first load")
	}
	loader.settings = aisettings.Settings{APIKey: "two", Model: "m2"}
	client.loadedAt = client.loadedAt.Add(-2 * refreshAfter)
	if got := client.current(); got.apiKey != "two" || got.Model() != "m2" {
		t.Errorf("a saved change was not picked up: key=%q model=%q", got.apiKey, got.Model())
	}
	loader.err = errors.New("mongo down")
	client.loadedAt = client.loadedAt.Add(-2 * refreshAfter)
	if got := client.current(); got.apiKey != "two" || !got.Ready() {
		t.Error("a load error must keep the last settings")
	}
}
