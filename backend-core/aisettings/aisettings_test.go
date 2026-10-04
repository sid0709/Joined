package aisettings

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
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

func TestAcornAndDeepSeekUseDifferentDocuments(t *testing.T) {
	if DocumentAcorn == "" || DocumentDeepSeek == "" || DocumentAcorn == DocumentDeepSeek {
		t.Fatalf("documents = %q and %q", DocumentAcorn, DocumentDeepSeek)
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

func TestOptionsDropBlanksAndRepeats(t *testing.T) {
	got := Options("gpt-env", "", "gpt-4o", "gpt-env")
	if len(got) != 2 || got[0] != "gpt-env" || got[1] != "gpt-4o" {
		t.Errorf("options = %v", got)
	}
}

func TestListModelsKeepsChatModelsNewestFirst(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer sk-test" || r.URL.Path != "/v1/models" {
			http.Error(w, "no", http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"data":[
			{"id":"text-embedding-3-large","created":50},
			{"id":"gpt-5.6-sol","created":300},
			{"id":"gpt-4o-mini","created":100},
			{"id":"gpt-4o-realtime-preview","created":400},
			{"id":"o4-mini","created":200},
			{"id":"whisper-1","created":10},
			{"id":"gpt-image-1","created":250}]}`))
	}))
	defer server.Close()

	got, err := ListModels(context.Background(), server.URL+"/v1", "sk-test")
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"gpt-5.6-sol", "o4-mini", "gpt-4o-mini"}
	if !slices.Equal(got, want) {
		t.Errorf("models = %v, want %v", got, want)
	}
	if _, err := ListModels(context.Background(), server.URL+"/v1", "wrong"); err == nil {
		t.Error("a rejected key must be an error")
	}
	if _, err := ListModels(context.Background(), server.URL+"/v1", " "); !errors.Is(err, ErrNoKey) {
		t.Errorf("blank key = %v", err)
	}
}

func TestListModelsFallsBackToEveryIDForOtherProviders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"data":[{"id":"deepseek-chat","created":1},{"id":"deepseek-reasoner","created":2}]}`))
	}))
	defer server.Close()
	got, err := ListModels(context.Background(), server.URL, "k")
	if err != nil || len(got) != 2 || got[0] != "deepseek-reasoner" {
		t.Errorf("models = %v, %v", got, err)
	}
}
