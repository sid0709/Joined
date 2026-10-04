package deepseek

import (
	"context"
	"errors"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/aisettings"
	"github.com/sid0709/OpenSeat/backend-core/config"
)

type fakeLoader struct {
	settings aisettings.Settings
	err      error
}

func (f *fakeLoader) Get(context.Context) (aisettings.Settings, error) {
	return f.settings, f.err
}

func fallback() config.DeepSeek {
	return config.DeepSeek{
		APIKey:      "env-key",
		Model:       "deepseek-flash",
		BaseURL:     "https://api.deepseek.com",
		SearchURL:   "https://api.deepseek.com/anthropic",
		MaxSearches: 4,
	}
}

func TestReloadingPrefersSavedSettingsAndFallsBack(t *testing.T) {
	env := fallback()

	empty := NewReloading(&fakeLoader{}, env).current()
	if !empty.Ready() || empty.Model() != "deepseek-flash" || empty.apiKey != "env-key" {
		t.Errorf("no saved settings: ready=%v model=%q key=%q", empty.Ready(), empty.Model(), empty.apiKey)
	}
	if empty.searchURL != env.SearchURL || empty.maxSearches != env.MaxSearches {
		t.Errorf("search stayed on the environment: url=%q cap=%d", empty.searchURL, empty.maxSearches)
	}

	saved := NewReloading(&fakeLoader{settings: aisettings.Settings{APIKey: "db-key", Model: "deepseek-chat"}}, env).current()
	if saved.apiKey != "db-key" || saved.Model() != "deepseek-chat" || saved.searchURL != env.SearchURL {
		t.Errorf("saved settings: key=%q model=%q search=%q", saved.apiKey, saved.Model(), saved.searchURL)
	}

	none := NewReloading(&fakeLoader{}, config.DeepSeek{Model: "deepseek-flash"}).current()
	if none.Ready() {
		t.Error("no key anywhere must not be ready")
	}
	keyOnly := NewReloading(&fakeLoader{settings: aisettings.Settings{APIKey: "db-key"}}, env).current()
	if !keyOnly.Ready() || keyOnly.apiKey != "db-key" || keyOnly.Model() != "deepseek-flash" {
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
