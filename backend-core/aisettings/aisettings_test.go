package aisettings

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/config"
)

func testBox(t *testing.T) *Box {
	t.Helper()
	box, err := NewBox(base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", KeyBytes))))
	if err != nil {
		t.Fatal(err)
	}
	return box
}

func TestBoxRoundTripsAndHidesTheKey(t *testing.T) {
	box := testBox(t)
	sealed, err := box.Seal("sk-secret-value")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(sealed, "secret") {
		t.Fatal("sealed value leaks the key")
	}
	again, _ := box.Seal("sk-secret-value")
	if again == sealed {
		t.Error("sealing twice must differ (random nonce)")
	}
	if got, err := box.Open(sealed); err != nil || got != "sk-secret-value" {
		t.Errorf("Open = %q, %v", got, err)
	}
}

func TestBoxRejectsTamperingAndWrongKey(t *testing.T) {
	box := testBox(t)
	sealed, _ := box.Seal("sk-abc")
	other, _ := NewBox(base64.StdEncoding.EncodeToString([]byte(strings.Repeat("z", KeyBytes))))
	if _, err := other.Open(sealed); err == nil {
		t.Error("another key opened it")
	}
	if _, err := box.Open(sealed[:len(sealed)-4] + "AAAA"); err == nil {
		t.Error("tampered value opened")
	}
	if _, err := box.Open("not base64!"); err == nil {
		t.Error("garbage opened")
	}
}

func TestBoxNeedsAValidKey(t *testing.T) {
	if box, err := NewBox(""); box != nil || err != nil {
		t.Errorf("blank key = %v, %v", box, err)
	}
	var none *Box
	if _, err := none.Seal("x"); !errors.Is(err, ErrNoEncryptionKey) {
		t.Errorf("Seal without a key = %v", err)
	}
	if _, err := NewBox("short"); err == nil {
		t.Error("short key accepted")
	}
	if _, err := NewBox(base64.StdEncoding.EncodeToString([]byte("too short"))); err == nil {
		t.Error("wrong-size key accepted")
	}
}

func TestHintShowsOnlyTheTail(t *testing.T) {
	if got := hint("sk-proj-abcdefghijWXYZ"); got != "…WXYZ" {
		t.Errorf("hint = %q", got)
	}
	if got := hint("short"); got != "…" {
		t.Errorf("short key hint = %q", got)
	}
}

type fakeLoader struct {
	settings Settings
	err      error
}

func (f *fakeLoader) Get(context.Context) (Settings, error) { return f.settings, f.err }

func TestModelPrefersSavedSettingsAndFallsBack(t *testing.T) {
	env := config.OpenAI{APIKey: "env-key", Model: "env-model", BaseURL: "https://example.test/v1"}

	empty := NewModel(&fakeLoader{}, env)
	if !empty.Ready() || empty.Model() != "env-model" {
		t.Errorf("no saved settings: ready=%v model=%q", empty.Ready(), empty.Model())
	}

	saved := NewModel(&fakeLoader{settings: Settings{APIKey: "db-key", Model: "db-model"}}, env)
	if saved.Model() != "db-model" {
		t.Errorf("saved model = %q", saved.Model())
	}

	none := NewModel(&fakeLoader{}, config.OpenAI{})
	if none.Ready() {
		t.Error("no key anywhere must not be ready")
	}
	keyOnly := NewModel(&fakeLoader{settings: Settings{APIKey: "db-key"}}, config.OpenAI{Model: "env-model"})
	if !keyOnly.Ready() || keyOnly.Model() != "env-model" {
		t.Errorf("saved key with env model: ready=%v model=%q", keyOnly.Ready(), keyOnly.Model())
	}
}

func TestModelPicksUpAChangeAndSurvivesALoadError(t *testing.T) {
	loader := &fakeLoader{settings: Settings{APIKey: "one", Model: "m1"}}
	model := NewModel(loader, config.OpenAI{})
	if model.Model() != "m1" {
		t.Fatal("first load")
	}
	loader.settings = Settings{APIKey: "two", Model: "m2"}
	model.loadedAt = model.loadedAt.Add(-2 * refreshAfter)
	if model.Model() != "m2" {
		t.Error("a saved change was not picked up after the refresh interval")
	}
	loader.err = errors.New("mongo down")
	model.loadedAt = model.loadedAt.Add(-2 * refreshAfter)
	if model.Model() != "m2" || !model.Ready() {
		t.Error("a load error must keep the last settings")
	}
}

func TestOptionsKeepEnvAndSavedModelsInTheList(t *testing.T) {
	got := Options("gpt-env", "gpt-4o", "")
	if got[0] != Models[0] || got[len(got)-1] != "gpt-env" || len(got) != len(Models)+1 {
		t.Errorf("options = %v", got)
	}
	if len(Options()) != len(Models) {
		t.Error("no extras must give the plain catalog")
	}
	Options("x")
	if len(Models) != 5 {
		t.Error("Options must not modify Models")
	}
}
